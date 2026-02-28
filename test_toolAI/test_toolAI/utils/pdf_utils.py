import fitz  # PyMuPDF

def extract_text_from_pdf(file_path):
    """Đọc file PDF và trả về toàn bộ nội dung text"""
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text
