import json
import math
import os
import sys
import zipfile
from contextlib import closing
from pathlib import Path


def choose_device(requested):
    import torch
    if requested == 'gpu' and not torch.cuda.is_available():
        raise RuntimeError('GPU requested but CUDA is unavailable in the MinerU container')
    return 'cuda' if requested != 'cpu' and torch.cuda.is_available() else 'cpu'


def block_text(item):
    if item['type'] == 'table':
        return '\n'.join([*item.get('table_caption', []), item.get('table_body', ''), *item.get('table_footnote', [])]).strip()
    if item['type'] == 'image':
        return '\n'.join([*item.get('image_caption', []), *item.get('image_footnote', [])]).strip()
    return str(item.get('text', '')).strip()


def line_detections(blocks, sx, sy):
    seen, output = set(), []
    def walk(block):
        for line in block.get('lines', []):
            bbox = line.get('bbox')
            if not bbox or len(bbox) != 4 or not all(math.isfinite(float(v)) for v in bbox):
                continue
            spans = line.get('spans', [])
            text = ' '.join(str(span.get('content', '')) for span in spans).strip()
            key = (*bbox, text)
            if key in seen:
                continue
            seen.add(key)
            x0, y0, x1, y1 = bbox
            scores = [float(span['score']) for span in spans if isinstance(span.get('score'), (int, float)) and math.isfinite(span['score'])]
            output.append({'id': len(output) + 1, 'text': text,
                           'confidence': sum(scores) / len(scores) if scores else None,
                           'polygon': [[x0*sx,y0*sy],[x1*sx,y0*sy],[x1*sx,y1*sy],[x0*sx,y1*sy]]})
        for child in block.get('blocks', []):
            walk(child)
    for block in blocks:
        walk(block)
    return output


def main(job):
    import pypdfium2 as pdfium
    request = json.loads((job / 'request.json').read_text())
    device = choose_device(request['device'])
    os.environ['MINERU_DEVICE_MODE'] = device
    os.environ['MINERU_TABLE_MERGE_ENABLE'] = '0'
    from mineru.cli.common import do_parse
    with closing(pdfium.PdfDocument(job / 'input.pdf')) as original:
        if any(number > len(original) for number in request['pages']):
            raise ValueError('Requested page outside PDF')
        with closing(pdfium.PdfDocument.new()) as subset:
            subset.import_pages(original, [number - 1 for number in request['pages']])
            subset.save(job / 'selected.pdf')
    print(f'MinerU starting {len(request["pages"])} pages on {device}', flush=True)
    do_parse(str(job / 'output'), ['document'], [(job / 'selected.pdf').read_bytes()], ['ch'],
             backend='pipeline', parse_method='auto', formula_enable=False, table_enable=True,
             f_draw_layout_bbox=False, f_draw_span_bbox=False, f_dump_md=False,
             f_dump_middle_json=True, f_dump_model_output=False, f_dump_orig_pdf=True, f_dump_content_list=True)
    directory = job / 'output/document/auto'
    middle = json.loads((directory / 'document_middle.json').read_text())
    content = json.loads((directory / 'document_content_list.json').read_text())
    result = {'engine': 'MinerU', 'pages': []}
    with closing(pdfium.PdfDocument(directory / 'document_origin.pdf')) as document, \
            zipfile.ZipFile(job / 'result.zip', 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for index, number in enumerate(request['pages']):
            info = middle['pdf_info'][index]
            page = document[index]
            bitmap = None
            try:
                bitmap = page.render(scale=min(3.0, 3000 / max(page.get_size())))
                image = bitmap.to_pil().convert('RGB')
                width, height = image.size
                pw, ph = info['page_size']
                blocks = []
                for item in content:
                    if item.get('page_idx') != index:
                        continue
                    text = block_text(item)
                    if not text:
                        continue
                    box = item.get('bbox')
                    bbox = [box[0]*width/1000, box[1]*height/1000, box[2]*width/1000, box[3]*height/1000] if box else []
                    label = 'title' if item.get('text_level') else item['type']
                    blocks.append({'text': text, 'type': label, 'bbox': bbox})
                detections = line_detections(info.get('preproc_blocks', info.get('para_blocks', [])), width/pw, height/ph)
                preview = {'pageNumber': number, 'width': width, 'height': height, 'device': device,
                           'engine': 'MinerU', 'detections': detections,
                           'layoutBlocks': [{'type': b['type'], 'bbox': b['bbox']} for b in blocks if b['bbox']]}
                png = job / f'page-{number}.png'
                image.save(png)
                archive.write(png, png.name)
                archive.writestr(f'page-{number}.json', json.dumps(preview, ensure_ascii=False))
                result['pages'].append({'pageNumber': number, 'width': width, 'height': height, 'device': device, 'blocks': blocks})
                print(f'MinerU completed page {number}: {len(blocks)} blocks, {len(detections)} text lines ({device})', flush=True)
            finally:
                if bitmap is not None:
                    bitmap.close()
                page.close()
        archive.writestr('result.json', json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main(Path(sys.argv[1]))
