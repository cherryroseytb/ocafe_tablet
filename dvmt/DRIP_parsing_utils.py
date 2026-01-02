@staticmethod
def find_data_extract_start(df, search_range=None, consecutive_threshold=10):
    consecutive_count = 0
    start_index = None
    search_range = search_range if search_range is not None else len(df)
    
    for i in range(min(search_range, len(df))):
        try:
            # 해당 행의 모든 값이 숫자로 변환 가능한지 확인
            row = df.iloc[i]
            # 각 컬럼별로 숫자 변환 시도
            pd.to_numeric(row, errors='raise')
            
            if start_index is None:
                start_index = i
            consecutive_count += 1
                
        except (ValueError, TypeError):
            consecutive_count = 0
            start_index = None
            continue
            
        if consecutive_count >= consecutive_threshold:
            return start_index
    
    return None