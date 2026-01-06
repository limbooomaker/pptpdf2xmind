#!/usr/bin/env python3
import sys
import json
import os
import gc
from pdf2image import convert_from_path
import pdfplumber
import psutil

def get_memory_usage():
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / 1024 / 1024

def process_pdf(pdf_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    
    # 降低DPI设置以减少内存消耗（从200降到150）
    dpi = 150
    
    # 分批处理页面，减少内存峰值
    batch_size = 10
    
    pages_data = []
    
    try:
        # 获取总页数
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            print(f"Processing PDF with {total_pages} pages...", file=sys.stderr)
        
        # 分批处理
        for batch_start in range(1, total_pages + 1, batch_size):
            batch_end = min(batch_start + batch_size - 1, total_pages)
            print(f"Processing pages {batch_start}-{batch_end}...", file=sys.stderr)
            
            # 只转换当前批次的页面
            images = convert_from_path(
                pdf_path, 
                dpi=dpi,
                first_page=batch_start,
                last_page=batch_end
            )
            
            # 处理当前批次的页面
            with pdfplumber.open(pdf_path) as pdf:
                for idx, image in enumerate(images, start=batch_start):
                    image_filename = f"page_{idx:03d}.png"
                    image_path = os.path.join(output_dir, image_filename)
                    
                    # 使用中等质量压缩以减少内存
                    image.save(image_path, 'PNG', optimize=True, quality=85)
                    
                    page = pdf.pages[idx - 1]
                    text = page.extract_text() or ""
                    
                    pages_data.append({
                        "page_num": idx,
                        "image_path": image_path,
                        "text": text
                    })
                    
                    # 显式释放图像对象
                    del image
            
            # 显式清理内存
            del images
            gc.collect()
            
            # 打印内存使用情况
            mem_usage = get_memory_usage()
            print(f"Memory usage after batch: {mem_usage:.2f} MB", file=sys.stderr)
        
        return pages_data
        
    except Exception as e:
        print(f"Error during PDF processing: {str(e)}", file=sys.stderr)
        raise

if __name__ == "__main__":
    if len(sys.argv) < 3:
        error_msg = json.dumps({"error": "Usage: python pdf_processor.py <pdf_path> <output_dir>"})
        print(error_msg)
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    # 验证文件存在性
    if not os.path.exists(pdf_path):
        error_msg = json.dumps({"status": "error", "message": f"PDF file not found: {pdf_path}"})
        print(error_msg)
        sys.exit(1)
    
    try:
        result = process_pdf(pdf_path, output_dir)
        output = json.dumps({"status": "success", "data": result})
        print(output)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        error_msg = json.dumps({
            "status": "error", 
            "message": str(e),
            "traceback": error_details
        })
        print(error_msg)
        sys.exit(1)