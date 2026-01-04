#!/usr/bin/env python3
import sys
import json
import os
from pdf2image import convert_from_path
import pdfplumber

def process_pdf(pdf_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    
    # 使用原始DPI设置（200）
    images = convert_from_path(pdf_path, dpi=200)
    pages_data = []
    
    # 预先打开PDF文件，避免重复打开
    with pdfplumber.open(pdf_path) as pdf:
        for idx, image in enumerate(images, start=1):
            image_filename = f"page_{idx:03d}.png"
            image_path = os.path.join(output_dir, image_filename)
            
            # 使用高质量压缩
            image.save(image_path, 'PNG', optimize=True, quality=95)
            
            page = pdf.pages[idx - 1]
            text = page.extract_text() or ""
            
            pages_data.append({
                "page_num": idx,
                "image_path": image_path,
                "text": text
            })
    
    return pages_data

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python pdf_processor.py <pdf_path> <output_dir>"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    try:
        result = process_pdf(pdf_path, output_dir)
        print(json.dumps({"status": "success", "data": result}))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)