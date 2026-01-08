# HTML 파일 수정 가이드

## 📝 수정 사항

`compare_tv.html` 파일의 스크립트 로딩 부분을 다음과 같이 수정해야 합니다.

### 현재 코드 (라인 670-702)

```html
<script>
    const selectedDoes = {{ selected_does_json|safe }};
    const initialLayouts = {{ layouts_json|default:"null"|safe }};
    const profileTitle = "{{ profile.title|escapejs }}";
    const profileId = {{ profile.id }};
    
    const initialHiddenColumns = {{ hidden_columns_json|safe }};
    const initialHiddenRows = {{ hidden_rows_json|safe }};
    const initialColumnOrder = {{ column_order_json|safe }};
    const initialReferenceColumns = {{ reference_columns_json|safe }};
    
    const URLS = {
        colorfilterEditor: "{% url 'pao:tv_colorfilter_edit' %}",
        linefactorEditor: "{% url 'pao:tv_linefactor_edit' %}",
        ivlColorTable: "{% url 'pao:tv_get_ivl_color_table' %}",
        ivlTable: "{% url 'pao:tv_get_ivl_table' %}",
        angleTable: "{% url 'pao:tv_get_angle_table' %}",
        ltTable: "{% url 'pao:tv_get_lt_table' %}",
        graphOption: "{% url 'pao:tv_get_graph_options' %}",
        gamutAnalysis: "{% url 'pao:tv_gamut_analysis' %}",
        updateDynamic: "{% url 'pao:tv_get_dynamic_graph_data' %}",
        getChart: "{% url 'pao:tv_get_chart_data' %}",
        openBaseline: "{% url 'pao:tv_deltav_baseline_edit' %}",
        refreshBaseline: "{% url 'pao:tv_get_deltav_baselines' %}",
        applyDelta: "{% url 'pao:tv_get_deltav_baseline_data' %}",
        saveAdditions: "{% url 'pao:tv_save_additions' profile.id %}",
        colorFilterList: "{% url 'pao:tv_colorfilter_list' %}",
        lineFactorList: "{% url 'pao:tv_linefactor_list' %}",
    }
</script>
```

### 수정된 코드

```html
<script>
    // [기존] 전역 변수는 그대로 유지 (Django 템플릿 변수)
    const selectedDoes = {{ selected_does_json|safe }};
    const initialLayouts = {{ layouts_json|default:"null"|safe }};
    const profileTitle = "{{ profile.title|escapejs }}";
    const profileId = {{ profile.id }};
    
    const initialHiddenColumns = {{ hidden_columns_json|safe }};
    const initialHiddenRows = {{ hidden_rows_json|safe }};
    const initialColumnOrder = {{ column_order_json|safe }};
    const initialReferenceColumns = {{ reference_columns_json|safe }};
    
    const URLS = {
        colorfilterEditor: "{% url 'pao:tv_colorfilter_edit' %}",
        linefactorEditor: "{% url 'pao:tv_linefactor_edit' %}",
        ivlColorTable: "{% url 'pao:tv_get_ivl_color_table' %}",
        ivlTable: "{% url 'pao:tv_get_ivl_table' %}",
        angleTable: "{% url 'pao:tv_get_angle_table' %}",
        ltTable: "{% url 'pao:tv_get_lt_table' %}",
        graphOption: "{% url 'pao:tv_get_graph_options' %}",
        gamutAnalysis: "{% url 'pao:tv_gamut_analysis' %}",
        updateDynamic: "{% url 'pao:tv_get_dynamic_graph_data' %}",
        getChart: "{% url 'pao:tv_get_chart_data' %}",
        openBaseline: "{% url 'pao:tv_deltav_baseline_edit' %}",
        refreshBaseline: "{% url 'pao:tv_get_deltav_baselines' %}",
        applyDelta: "{% url 'pao:tv_get_deltav_baseline_data' %}",
        saveAdditions: "{% url 'pao:tv_save_additions' profile.id %}",
        colorFilterList: "{% url 'pao:tv_colorfilter_list' %}",
        lineFactorList: "{% url 'pao:tv_linefactor_list' %}",
        device_detail: "{% url 'pao:device_detail' 0 %}"  // [추가] Device detail URL
    }
</script>

<!-- [수정] ES6 모듈로 로드 - type="module" 속성 필수! -->
<script type="module" src="{% static 'pao/compare_tv/compare_tv.js' %}"></script>
```

## 🔍 주요 변경 사항

### 1. Device Detail URL 추가 ✨
```javascript
device_detail: "{% url 'pao:device_detail' 0 %}"
```
- `goToDeviceDetail()` 함수에서 사용됩니다.
- URL에서 `0`을 실제 DOE ID로 치환하여 사용합니다.

### 2. 모듈 스크립트 로드 방식 변경 ✨
```html
<!-- 기존 -->
<script src="{% static 'pao/compare_tv/compare_tv.js' %}"></script>

<!-- 변경 -->
<script type="module" src="{% static 'pao/compare_tv/compare_tv.js' %}"></script>
```

**중요**: `type="module"` 속성을 반드시 추가해야 합니다!

## ✅ 체크리스트

- [ ] HTML에 `URLS.device_detail` URL 추가
- [ ] `<script>` 태그에 `type="module"` 속성 추가
- [ ] 기존 `compare_tv.js` 파일을 새 파일로 교체
- [ ] 모든 새로운 JS 파일들을 `static/pao/compare_tv/` 디렉토리에 배치

## 🚨 주의사항

1. **기존 파일 백업**: 수정 전에 반드시 원본 파일들을 백업하세요.
   ```bash
   cp compare_tv.html compare_tv.html.backup
   cp compare_tv.js compare_tv.js.backup
   ```

2. **브라우저 캐시 삭제**: 수정 후 브라우저 캐시를 완전히 삭제하세요.
   - Chrome: Ctrl+Shift+Delete → "캐시된 이미지 및 파일" 선택
   - 또는 Hard Refresh: Ctrl+F5

3. **개발자 도구 콘솔 확인**: 에러 메시지가 있는지 확인하세요.
   - F12 → Console 탭

4. **CORS 에러**: ES6 모듈은 `file://` 프로토콜에서 작동하지 않습니다.
   - 반드시 Django 개발 서버를 통해 접근하세요: `http://localhost:8000/`

## 📞 문제 해결

### 문제: "Uncaught SyntaxError: Cannot use import statement outside a module"
**해결**: `<script>` 태그에 `type="module"` 속성이 누락되었습니다.

### 문제: "selectedDoes is not defined"
**해결**: Django View에서 `selected_does_json` 컨텍스트 변수가 제공되지 않았거나 HTML에 올바르게 렌더링되지 않았습니다.

### 문제: TPID가 표시되지 않고 "DOE 5" 형식으로 표시됨
**해결**: 
1. `selectedDoes` 변수가 올바르게 정의되었는지 확인
2. 각 DOE 객체에 `runsheet_lot`, `gls_id`, `sequence` 속성이 있는지 확인
3. 브라우저 콘솔에서 `window.getGlobalState().doeIdToTpidMap` 확인

### 문제: 모든 함수가 작동하지 않음
**해결**: 
1. 브라우저 콘솔에서 에러 메시지 확인
2. 모든 파일이 올바른 위치에 있는지 확인
3. 파일명과 import 경로가 정확한지 확인
