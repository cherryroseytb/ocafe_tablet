# Compare TV 코드 리팩토링 가이드

## 📋 개요

기존 3000줄의 단일 JavaScript 파일(`compare_tv.js`)을 관련 기능별로 클래스화하여 9개의 모듈로 분리했습니다.

## 📁 파일 구조

```
static/pao/compare_tv/
├── GlobalState.js          # 전역 상태 관리 (싱글톤)
├── Utils.js                # 유틸리티 함수
├── TableManager.js         # 테이블 관련 (가장 큰 파일, 997줄)
├── DataLoader.js           # 데이터 로딩
├── AnalysisManager.js      # 색역 분석
├── ChartManager.js         # 차트 관리
├── StateManager.js         # 상태 저장/복원
├── ExportManager.js        # 데이터 내보내기
└── compare_tv.js           # 메인 파일 (새 버전)
```

## 🔧 HTML 수정 사항

### 기존 코드
```html
<script src="{% static 'pao/compare_tv/compare_tv.js' %}"></script>
```

### 수정된 코드
```html
<!-- [수정] ES6 모듈로 변경 -->
<script type="module" src="{% static 'pao/compare_tv/compare_tv.js' %}"></script>
```

**중요**: `type="module"` 속성을 반드시 추가해야 합니다!

## ✅ 완전히 구현된 기능

### 1. GlobalState.js ✅
- 전역 변수 및 상태 관리
- 싱글톤 패턴으로 구현
- 테이블, 차트, 필터 등 모든 상태 관리

### 2. Utils.js ✅
- `showToast()` - 토스트 메시지 표시
- `openEditor()` - 에디터 창 열기
- `fieldToId()` / `idToField()` - 필드 ↔ ID 변환
- `enableTableFocus()` - 테이블 포커스 설정
- `filterSpectrumData()` - 스펙트럼 데이터 필터링
- `getFieldLabel()` - 필드 라벨 가져오기

### 3. TableManager.js ✅ (997줄)
**테이블 초기화 및 상태 관리**
- `initializeTableState()` - 초기 상태 로드
- `loadInitialTableData()` - 초기 데이터 로드
- `createTable()` - 테이블 생성
- `getTableStateForSave()` - 저장용 상태 추출
- `applyVisibilityState()` - 가시성 상태 적용
- `applyRowVisibilityState()` - Row 가시성 적용
- `reapplyRowVisibility()` - Row 가시성 재적용

**클립보드 기능**
- `setupClipboardShortcuts()` - 단축키 설정
- `handleClipboardShortcut()` - 단축키 핸들러
- `copyAllTableData()` - 전체 데이터 복사

**컬럼/행 가시성 관리**
- `initializeColumnVisibilityDropdown()` - 컬럼 드롭다운 초기화
- `initializeRowVisibilityDropdown()` - Row 드롭다운 초기화
- `updateColumnVisibilityList()` - 컬럼 리스트 업데이트
- `updateRowVisibilityList()` - Row 리스트 업데이트
- `toggleColumnVisibility()` - 컬럼 가시성 토글
- `toggleRowVisibility()` - Row 가시성 토글
- `showAllRows()` / `hideAllRows()` - 모든 Row 표시/숨김
- `showAllColumns()` / `hideAllColumns()` - 모든 컬럼 표시/숨김

**컬럼 선택 및 스타일**
- `showContextMenu()` - 컨텍스트 메뉴 표시
- `toggleColumnSelection()` - 컬럼 선택 토글
- `toggleReferenceColumn()` - Reference 컬럼 토글
- `updateColumnStyles()` - 컬럼 스타일 업데이트
- `getSelectedColumns()` / `getReferenceColumns()` - 선택/Reference 컬럼 조회
- `clearColumnSelection()` / `clearReferenceColumns()` - 선택 초기화
- `toggleSelectAllColumns()` - 전체 선택/해제
- `updateSelectAllButton()` - 선택 버튼 텍스트 업데이트

### 4. DataLoader.js ✅
- `loadIvlColorTableData()` - IVL + Color 테이블 로드
- `loadAngleTableData()` - Angle 테이블 로드
- `loadLtTableData()` - LT 테이블 로드
- `loadAllAdditionalTablesAsync()` - 모든 추가 테이블 로드

### 5. compare_tv.js (메인 파일) ✅
**전역 함수 (window 객체에 노출)**
- `initializeTpidMapping()` - TPID 매핑 초기화
- `convertDoeIdToTpid()` - DOE ID → TPID 변환
- `convertTracesToTpid()` - Plotly traces 변환
- `goToDeviceDetail()` - Device Detail 페이지 이동

**이벤트 핸들러**
- 그래프 생성 버튼 이벤트
- DOMContentLoaded 이벤트
- 창 닫기 전 이벤트

## 🚧 구현 필요한 기능 (TODO)

다음 매니저들은 뼈대만 생성되어 있으며, 원본 코드를 이식해야 합니다:

### AnalysisManager.js (라인 1235-1374)
- `validateGamutButton()` 
- `openGamutAnalysisWindow()`
- `sendGamutDataToWindow()`

### ChartManager.js (라인 1380-2064)
- `loadGraphOptions()`
- `updateGraphFilters()`
- `validateForm()`
- `updateDynamicGraph()`
- `initializeChartLayouts()`
- `refreshColorFilterDropdown()`
- `refreshLineFactorDropdown()`
- 기타 차트 관련 함수들...

### StateManager.js (라인 2071-2429)
- `restoreCompareState()`
- `handleDoeChanges()`
- `refreshSingleDoeColumn()`
- TPID 관련 함수들
- Angular Spectrum 필터 함수들
- Delta V 관련 함수들

### ExportManager.js (라인 2434-2502)
- `exportSelectedData()`

## 📝 구현 방법

각 TODO 함수를 구현하려면:

1. **원본 파일에서 해당 라인 범위의 코드 복사**
   ```javascript
   // 예: AnalysisManager의 validateGamutButton (line 1235-1255)
   ```

2. **클래스 메서드로 변환**
   ```javascript
   // 기존
   function validateGamutButton() {
       const gamutBtn = document.getElementById('gamutAnalysisBtn');
       // ...
   }
   
   // 변환 후
   validateGamutButton() {
       const gamutBtn = document.getElementById('gamutAnalysisBtn');
       // ...
   }
   ```

3. **전역 변수를 state로 변경**
   ```javascript
   // 기존
   gamutAnalysisWindow = window.open(...);
   
   // 변환 후
   this.state.gamutAnalysisWindow = window.open(...);
   ```

4. **전역 함수 호출을 this.메서드 또는 Utils.메서드로 변경**
   ```javascript
   // 기존
   showToast("메시지", "success");
   
   // 변환 후
   Utils.showToast("메시지", "success");
   ```

5. **다른 매니저 함수 호출**
   ```javascript
   // 기존
   reapplyRowVisibility();
   
   // 변환 후
   this.tableManager.reapplyRowVisibility();
   ```

## 🎯 테스트 계획

### Phase 1: 기본 기능 테스트
1. ✅ 페이지 로드 및 테이블 표시
2. ✅ 컬럼/행 가시성 토글
3. ✅ 컬럼 선택 및 스타일
4. ✅ 데이터 로드 (Color Filter, Line Factor)
5. ⏳ 그래프 생성
6. ⏳ 색역 분석
7. ⏳ Export 기능

### Phase 2: 고급 기능 테스트
- ⏳ 상태 저장/복원
- ⏳ Device Detail 이동 후 복귀
- ⏳ 드롭다운 refresh
- ⏳ Angular Spectrum 필터
- ⏳ Delta V 기준선

## 🔥 주의사항

1. **전역 함수 노출**: Django 템플릿과 HTML 인라인 이벤트에서 사용하는 함수들은 `window` 객체에 명시적으로 할당해야 합니다.

   ```javascript
   window.convertDoeIdToTpid = convertDoeIdToTpid;
   window.goToDeviceDetail = goToDeviceDetail;
   ```

2. **순환 의존성 방지**: 매니저들 간의 상호 참조를 최소화하고, 필요시 생성자에서 주입합니다.

3. **Django 템플릿 변수**: `initialDoeIdToTpidMap`, `initialLayouts` 등은 HTML에서 정의되어야 합니다.

4. **타입 변환**: `fieldToId()`/`idToField()` 사용 시 null 체크를 반드시 수행합니다.

## 🚀 다음 단계

1. **나머지 매니저 구현** - ChartManager, AnalysisManager, StateManager, ExportManager의 TODO 함수들을 원본에서 이식

2. **통합 테스트** - 모든 기능이 정상 작동하는지 확인

3. **코드 최적화** - 중복 코드 제거, 성능 개선

4. **문서화** - JSDoc 주석 추가

## 📞 문의

문제 발생 시 각 파일 상단의 `// [추가]` 또는 `// [수정]` 주석을 참고하여 변경 사항을 확인하세요.
