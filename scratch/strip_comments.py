import os
import re
import sys

# Regex patterns for stripping comments safely without breaking strings or URLs
def strip_python_comments(content):
    pattern = re.compile(
        r'#.*?$|\'\'\'.*?\'\'\'|""".*?"""|\'(?:\\.|[^\\\'])*\'|"(?:\\.|[^\\"])*"',
        re.DOTALL | re.MULTILINE
    )
    def replacer(match):
        s = match.group(0)
        if s.startswith('#'):
            return "" # Strip comments
        else:
            return s # Keep string literals and SQL statements
    return pattern.sub(replacer, content)

def strip_js_css_comments(content):
    pattern = re.compile(
        r'//.*?$|/\*.*?\*/|\'(?:\\.|[^\\\'])*\'|"(?:\\.|[^\\"])*"|`(?:\\.|[^\\`])*`',
        re.DOTALL | re.MULTILINE
    )
    def replacer(match):
        s = match.group(0)
        if s.startswith('/'):
            return "" # Strip comments
        else:
            return s # Keep string literals, regexes, backticks, and URLs
    return pattern.sub(replacer, content)

def strip_html_comments(content):
    # HTML comments are <!-- comment -->
    return re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)

files_to_process = [
    ('app.py', 'python'),
    ('templates/index.html', 'html'),
    ('static/css/style.css', 'js_css'),
    ('static/js/app.js', 'js_css'),
    ('static/js/webcam.js', 'js_css'),
    ('static/js/dashboard.js', 'js_css'),
    ('static/js/irrigation.js', 'js_css'),
    ('static/js/history.js', 'js_css'),
    ('static/js/batch.js', 'js_css')
]

for filename, file_type in files_to_process:
    filepath = os.path.join('/Users/kuldeep/Documents/Crop2', filename)
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    original_len = len(content)
    
    if file_type == 'python':
        content = strip_python_comments(content)
    elif file_type == 'html':
        content = strip_html_comments(content)
    elif file_type == 'js_css':
        content = strip_js_css_comments(content)
        
    # Clean up empty lines that only contained comments (optional but makes code look neat)
    lines = content.splitlines()
    cleaned_lines = []
    for line in lines:
        if line.strip() or not line:
            cleaned_lines.append(line)
    content = "\n".join(cleaned_lines)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Processed {filename}: {original_len} -> {len(content)} bytes.")

print("All comments removed successfully.")
