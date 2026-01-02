from django import template

register = template.Library()

@register.filter
def get_item(dictionary, key):
    """ 딕셔너리에서 key에 해당하는 값을 가져오는 템플릿 필터 """
    return dictionary.get(key, None)
    
@register.filter
def join_set(value, arg=", "):
    """ set을 정렬된 문자열로 변환해줌 """
    return arg.join(sorted(value))
    
@register.filter
def scientific(value, precision=2):
    try:
        num = float(value)
        format_str = f"{{:.{precision}e}}"
        return format_str.format(num)
    except (ValueError, TypeError):
        return "-"

@register.filter
def scientific_pair(value, precision=2):
    try:
        h, e = value.split('/')
        h_formatted = scientific(h, precision) if h.strip() != '-' else '-'
        e_formatted = scientific(e, precision) if e.strip() != '-' else '-'
        return f"{h_formatted}/{e_formatted}"
    except Exception:
        return "-"

@register.filter
def split(value, delimiter=' '):
    return value.split(delimiter)
    
@register.filter
def dict_get(d, key):
    return d.get(key, '')