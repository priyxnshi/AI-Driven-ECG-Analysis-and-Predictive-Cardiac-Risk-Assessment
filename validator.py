import os
import re
import csv
import logging
from scipy.io import loadmat
from models import db, AuditLog

# Configure logger
os.makedirs('logs', exist_ok=True)
audit_logger = logging.getLogger('audit')
if not audit_logger.handlers:
    handler = logging.FileHandler('logs/audit.log')
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    audit_logger.addHandler(handler)
    audit_logger.setLevel(logging.INFO)

# File signatures to reject (common non-ECG formats)
SIGNATURES_TO_REJECT = {
    b'%PDF-': 'PDF document',
    b'\x89PNG\r\n\x1a\n': 'PNG image',
    b'\xff\xd8\xff': 'JPEG image',
    b'GIF87a': 'GIF image',
    b'GIF89a': 'GIF image',
    b'PK\x03\x04': 'ZIP archive/Office document',
    b'MZ': 'Executable file/DLL',
    b'Rar!\x1a\x07\x00': 'RAR archive',
    b'.Rar!\x1a\x07\x02\x00': 'RAR archive',
}

SIGNATURE_TO_ALLOWED_EXTS = {
    b'%PDF-': {'pdf'},
    b'\x89PNG\r\n\x1a\n': {'png'},
    b'\xff\xd8\xff': {'jpg', 'jpeg'},
    b'GIF87a': {'gif'},
    b'GIF89a': {'gif'},
    b'PK\x03\x04': {'zip', 'xlsx'}, # XLSX is a ZIP structure
    b'MZ': set(),
    b'Rar!\x1a\x07\x00': {'rar'},
    b'.Rar!\x1a\x07\x02\x00': {'rar'},
}

class ECGValidationError(Exception):
    pass

def log_validation_failure(filename, reason, ip_address=None, username=None):
    """Log validation failure to audit file and db"""
    msg = f"Rejected file '{filename}': {reason}"
    audit_logger.warning(msg)
    
    try:
        # Save to database AuditLog
        log = AuditLog(
            ip_address=ip_address or '127.0.0.1',
            username=username or 'system',
            event_type='invalid_upload',
            description=msg
        )
        db.session.add(log)
        db.session.commit()
    except Exception as db_err:
        print(f"Error writing to audit log DB: {db_err}")

def validate_ecg_file(file_path, original_filename, ip_address=None, username=None):
    """
    Perform strict validation of ECG file format, extension, MIME type and content.
    Returns detected category: 'digital-signal'
    Raises ECGValidationError on failure.
    """
    if not os.path.exists(file_path):
        raise ECGValidationError("File does not exist on server.")
        
    file_size = os.path.getsize(file_path)
    if file_size == 0:
        log_validation_failure(original_filename, "Zero-byte file", ip_address, username)
        raise ECGValidationError("Empty files are not allowed.")
        
    if file_size > 10 * 1024 * 1024: # 10MB limit
        log_validation_failure(original_filename, f"File size too large: {file_size} bytes", ip_address, username)
        raise ECGValidationError("File size exceeds the 10MB limit.")

    # 1. Verify extension
    ext = original_filename.lower().split('.')[-1] if '.' in original_filename else ''
    allowed_extensions = {'csv', 'dat', 'hea', 'mat', 'dcm', 'dicom', 'jpg', 'jpeg', 'png', 'xlsx'}
    
    if ext not in allowed_extensions:
        log_validation_failure(original_filename, f"Disallowed extension: .{ext}", ip_address, username)
        raise ECGValidationError(f"Invalid extension .{ext}. Allowed: .csv, .dat, .hea, .mat, .dcm, .jpg, .jpeg, .png, .xlsx")
        
    # 2. Check general magic bytes / file signatures to reject renamed files
    with open(file_path, 'rb') as f:
        head_bytes = f.read(16)
        
    for sig, allowed_exts in SIGNATURE_TO_ALLOWED_EXTS.items():
        if head_bytes.startswith(sig):
            if ext not in allowed_exts:
                file_desc = SIGNATURES_TO_REJECT.get(sig, 'Unknown file type')
                log_validation_failure(original_filename, f"Renamed file detected ({file_desc} signature matching .{ext} extension)", ip_address, username)
                raise ECGValidationError(f"Malicious or incorrect file type: signature indicates {file_desc}.")

    # 3. Content specific validation
    if ext == 'csv':
        # Validate ECG Structured CSV
        try:
            with open(file_path, 'r', newline='') as f:
                reader = csv.reader(f)
                header = next(reader)
                
                # Check for standard columns or numeric inputs
                header = [c.strip().strip("'\"").lower() for c in header]
                
                # Expect at least one time-like column and one signal-like column
                has_time = any(x in header for x in ['sample #', 'sample', 'time', 'index', 'elapsed'])
                has_signal = any(x in header for x in ['mlii', 'v5', 'ii', 'v1', 'v2', 'v3', 'v4', 'v6', 'lead'])
                
                # Fallback: if columns are purely numeric, it's a raw signal matrix (no headers)
                is_numeric_header = False
                try:
                    [float(x) for x in header if x]
                    is_numeric_header = True
                except ValueError:
                    pass
                
                if not (has_time or has_signal or is_numeric_header or len(header) >= 1):
                    log_validation_failure(original_filename, "Invalid CSV header layout for ECG signals", ip_address, username)
                    raise ECGValidationError("CSV columns must match ECG signal fields (e.g. Sample, MLII).")
                    
                # Validate some data lines
                lines_checked = 0
                for row in reader:
                    if lines_checked > 10:
                        break
                    if not row:
                        continue
                    # Ensure columns are numeric
                    try:
                        [float(val) for val in row if val.strip()]
                    except ValueError:
                        log_validation_failure(original_filename, f"Non-numeric values in CSV: row {lines_checked + 2}", ip_address, username)
                        raise ECGValidationError("ECG data rows must contain only numeric waveform values.")
                    lines_checked += 1
                
                if lines_checked == 0:
                    log_validation_failure(original_filename, "CSV contains no data rows", ip_address, username)
                    raise ECGValidationError("CSV contains no data rows.")
                    
        except Exception as e:
            if isinstance(e, ECGValidationError):
                raise
            log_validation_failure(original_filename, f"Corrupted CSV parsing error: {e}", ip_address, username)
            raise ECGValidationError(f"Invalid or corrupted CSV layout: {str(e)}")

    elif ext == 'hea':
        # Validate WFDB Header File (plain text)
        try:
            with open(file_path, 'r') as f:
                first_line = f.readline().strip()
                
            # Regex to match WFDB header specification: record_name num_channels fs num_samples
            # Example: 100 2 360 650000
            match = re.match(r'^\w+\s+\d+(\s+[\d\.]+)?(\s+\d+)?', first_line)
            if not match:
                log_validation_failure(original_filename, "Failed WFDB HEA format check", ip_address, username)
                raise ECGValidationError("HEA file does not match WFDB header file format.")
        except Exception as e:
            if isinstance(e, ECGValidationError):
                raise
            log_validation_failure(original_filename, f"HEA read error: {e}", ip_address, username)
            raise ECGValidationError("Corrupted WFDB header file.")

    elif ext == 'dat':
        # WFDB Binary data file. Requires matching .hea file.
        # We can check that the .dat has binary data.
        if file_size < 100:
            log_validation_failure(original_filename, "DAT file too short", ip_address, username)
            raise ECGValidationError("DAT file is too small to contain valid binary ECG signals.")
            
    elif ext == 'mat':
        # MATLAB MAT ECG format
        try:
            mat_data = loadmat(file_path)
            # Ensure there is numeric array content
            has_signals = False
            for k, v in mat_data.items():
                if not k.startswith('__') and hasattr(v, 'shape') and len(v.shape) >= 1:
                    has_signals = True
                    break
            if not has_signals:
                log_validation_failure(original_filename, "MAT file lacks arrays", ip_address, username)
                raise ECGValidationError("MAT file contains no ECG array data.")
        except Exception as e:
            log_validation_failure(original_filename, f"MAT file parsing failure: {e}", ip_address, username)
            raise ECGValidationError("MAT file is corrupted or not a valid Level 5 MATLAB format.")

    elif ext in ['dcm', 'dicom']:
        # DICOM ECG validation
        try:
            with open(file_path, 'rb') as f:
                f.seek(128)
                magic = f.read(4)
            if magic != b'DICM':
                log_validation_failure(original_filename, "Invalid DICOM preamble", ip_address, username)
                raise ECGValidationError("File does not contain valid DICOM header preamble.")
        except Exception as e:
            log_validation_failure(original_filename, f"DICOM validation failure: {e}", ip_address, username)
            raise ECGValidationError("Corrupted DICOM file structure.")

    elif ext == 'xlsx':
        # Validate Excel XLSX layout
        try:
            import pandas as pd
            df = pd.read_excel(file_path)
            if df.empty:
                log_validation_failure(original_filename, "Excel file is empty", ip_address, username)
                raise ECGValidationError("Excel file is empty.")
            # Verify columns are numeric
            for col in df.columns:
                if col.lower() not in ['sample #', 'sample', 'time', 'index', 'elapsed']:
                    try:
                        df[col].dropna().astype(float)
                    except Exception:
                        log_validation_failure(original_filename, "Excel contains non-numeric waveform data", ip_address, username)
                        raise ECGValidationError("ECG spreadsheet columns must contain only numeric waveform values.")
        except Exception as e:
            if isinstance(e, ECGValidationError):
                raise
            log_validation_failure(original_filename, f"Excel validation failure: {e}", ip_address, username)
            raise ECGValidationError(f"Invalid Excel sheet layout: {str(e)}")

    elif ext in ['jpg', 'jpeg', 'png']:
        # Validate Image quality and structure
        try:
            from PIL import Image
            img = Image.open(file_path)
            img.verify()
            img = Image.open(file_path)
            width, height = img.size
            if width < 100 or height < 100:
                log_validation_failure(original_filename, f"Image resolution too low ({width}x{height})", ip_address, username)
                raise ECGValidationError("Image resolution too low. Minimum 100x100 pixels required.")
        except Exception as e:
            if isinstance(e, ECGValidationError):
                raise
            log_validation_failure(original_filename, f"Corrupted or invalid image: {e}", ip_address, username)
            raise ECGValidationError("Invalid or corrupted image file.")
        return 'visual-scan'

    return 'digital-signal'
