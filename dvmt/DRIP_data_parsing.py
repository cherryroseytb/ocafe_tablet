import os
import pandas as pd
from datetime import datetime
from utils import ParsingUtils  # 유틸리티 함수 사용

class DataParsing:
    def __init__(self, folder_path: str):
        """
        데이터 파싱 클래스. 주어진 폴더에서 데이터를 추출하여 JSON 형태로 반환.

        Args:
            folder_path (str): 데이터가 저장된 루트 폴더 경로.
        """
        self.folder_path = folder_path
        self.utils = ParsingUtils()
        self.root_files = self._collect_files()  # 디렉토리 내 파일 정보 수집

    def _collect_files(self):
        """
        폴더 내에서 유효한 파일들을 수집.

        Returns:
            list: (폴더 경로, 파일 이름) 튜플 리스트.
        """
        collected_files = []
        for root, _, files in os.walk(self.folder_path):
            for file in files:
                collected_files.append((root, file))
        return collected_files

    def ltpl_parsing(self, file_type=".txt", check_item="TITLE", prefix="ltpl"):
        """
        LTPL 데이터 파일을 파싱하여, 동일한 sample (mat_name)에 대해 데이터를 병합.

        Args:
            file_type (str): 처리할 파일 확장자 (기본값: ".txt").
            check_item (str): 데이터 유효성을 검사할 키워드 (기본값: "TITLE").
            prefix (str): 데이터 키에 붙일 접두사 (기본값: "ltpl").

        Returns:
            list: 병합된 LTPL 데이터 리스트.
            str: 데이터 키 접두사.
        """
        parsed_dict = {}
        valid_keywords = ["77k_20ms", "289k"]

        if not self.root_files:
            print("No valid files found in the directory.")
            return [], prefix

        for root, file in self.root_files:
            file_lower = file.lower()
            if not any(keyword in file_lower for keyword in valid_keywords):
                continue  # 필요한 파일만 처리

            try:
                file_data = self.ltpl_parse_file(root, file, file_type, check_item, prefix)
                if not file_data:
                    continue  # 유효한 데이터가 없으면 스킵
                
                mat_name = file_data["mat_name"]  # ✅ sample_id 대신 mat_name 유지

                # 동일한 mat_name이 없으면 초기화
                if mat_name not in parsed_dict:
                    parsed_dict[mat_name] = {
                        "mat_name": file_data["mat_name"],
                        f"{prefix}_ms_equip": file_data[f"{prefix}_ms_equip"],
                        f"{prefix}_pd_equip": file_data[f"{prefix}_pd_equip"],
                        f"{prefix}_pd_date": file_data[f"{prefix}_pd_date"],
                        f"{prefix}_ms_date": file_data[f"{prefix}_ms_date"],
                        f"{prefix}_solvent": file_data[f"{prefix}_solvent"],
                    }

                # identifier(77k_20ms, 289k)에 따라 데이터를 저장
                if file_data[f"{prefix}_identifier"] == "77k_20ms":
                    parsed_dict[mat_name][f"{prefix}_wavelength_77k"] = file_data[f"{prefix}_wavelength"]
                    parsed_dict[mat_name][f"{prefix}_rawdata_77k"] = file_data[f"{prefix}_rawdata"]
                elif file_data[f"{prefix}_identifier"] == "289k":
                    parsed_dict[mat_name][f"{prefix}_wavelength_289k"] = file_data[f"{prefix}_wavelength"]
                    parsed_dict[mat_name][f"{prefix}_rawdata_289k"] = file_data[f"{prefix}_rawdata"]

            except Exception as e:
                print(f"Error processing {file}: {e}")

        return list(parsed_dict.values()), prefix

   def ltpl_parse_file(self, root, file, file_type=".txt", check_item="TITLE", prefix="ltpl"):
	    """
	    LTPL 개별 파일을 파싱하여 데이터를 추출.
	
	    Args:
	        root (str): 파일이 위치한 폴더 경로.
	        file (str): 처리할 파일 이름.
	        file_type (str): 파일 확장자 (기본값: ".txt").
	        check_item (str): 데이터 유효성을 검사할 키워드 (기본값: "TITLE").
	        prefix (str): 데이터 키에 붙일 접두사 (기본값: "ltpl").
	
	    Returns:
	        dict: 추출된 데이터 딕셔너리 (77K/289K 구분하여 저장).
	    """
	    file_path = os.path.join(root, file)
	    cond_list = root.split('/')
	
	    solvent_dict = {
	        "tol": "Toluene",
	        "thf": "THF",
	        "methf": "MeTHF",
	    }
	
	    try:
	        if not self.utils.is_valid_extension(file, file_type):
	            return {}
	
	        max_columns = self.utils.find_max_row(file_path)
	        column_names = [f"column_{i+1}" for i in range(max_columns)]
	        df = pd.read_csv(file_path, delimiter=r"\s+", header=None, names=column_names, dtype=str, encoding="cp949", engine="python")
	
	        if not self.utils.is_valid_content(df, check_item):
	            return {}
	
	        data_point_count = self.utils.find_valid_by_keyword(df, "NPOINTS")
	        data_extract_start = self.utils.find_data_extract(df)
	        data_extract_end = int(data_extract_start + data_point_count)
	
	        ltpl_wavelength = df.iloc[data_extract_start:data_extract_end, 0].astype(float).tolist()
	        ltpl_rawdata = df.iloc[data_extract_start:data_extract_end, 1].astype(float).tolist()
	
	        file_name_lower = file.lower()
	        solvent = next((value for key, value in solvent_dict.items() if key in file_name_lower), None)
	
	        # ✅ Identifier에 따라 77K/289K 구분하여 저장
	        if "77k_20ms" in file_name_lower:
	            return {
	                "mat_name": cond_list[-1],  # ✅ sample_id 대신 mat_name 유지
	                f"{prefix}_ms_equip": cond_list[-5],
	                f"{prefix}_pd_equip": cond_list[-4],
	                f"{prefix}_pd_date": self.utils.extract_date_from_string(cond_list[-3]),
	                f"{prefix}_ms_date": self.utils.extract_date_from_string(cond_list[-2]),
	                f"{prefix}_wavelength_77k": ltpl_wavelength,
	                f"{prefix}_rawdata_77k": ltpl_rawdata,
	                f"{prefix}_solvent": solvent,
	                f"{prefix}_root": root,  # ✅ 파일 위치 추가
	            }
	
	        elif "289k" in file_name_lower:
	            return {
	                "mat_name": cond_list[-1],
	                f"{prefix}_ms_equip": cond_list[-5],
	                f"{prefix}_pd_equip": cond_list[-4],
	                f"{prefix}_pd_date": self.utils.extract_date_from_string(cond_list[-3]),
	                f"{prefix}_ms_date": self.utils.extract_date_from_string(cond_list[-2]),
	                f"{prefix}_wavelength_289k": ltpl_wavelength,
	                f"{prefix}_rawdata_289k": ltpl_rawdata,
	                f"{prefix}_solvent": solvent,
	                f"{prefix}_root": root,
	            }
	
	        else:
	            return {}
	
	    except Exception as e:
	        print(f"Failed to parse {file}: {e}")
	        return {}
        
        
    
    #data_parsing.py
    def cv_parsing(self, file_type=".csv", prefix="cv"):
	
        if self.cv_device_dict is None:
            return []
        parsed_list = []
        
        if not self.root_files:
            return []
        for root, file in self.root_files:
            try:
                file_data = self.cv_parse_file(root, file, file_type, prefix)
                if file_data:
                    parsed_list.append(file_data)
            except Exception as e:
                print(f"error processing {file} : {e}")
        for file_data in parsed_list:
            material_name = file_data.get('mat_name')
            if self.cv_device_dict and material_name in self.cv_device_dict:
                file_data.update(self.cv_device_dict[material_name])
        return parsed_list, prefix
    
    def cv_parse_file(self, root, file, file_type=".csv", prefix="cv"):
        file_path = os.path.join(root, file)
        cond_list = root.split("/")
        file_data = {}
        
        try:
            if not self.utils.is_valid_extension(file, file_type):
                return []
            
            max_columns = 6
            column_names = [f"column_{i+1}" for i in range(max_columns)]
            df = pd.read_csv(file_path, header=None, names=column_names, dtype=str, encoding="utf-8")
            cv_aclevel, cv_frequency = None, None
            cv_vbias, cv_capdata = [], []
            
            data_start_idx = df[df["column_1"] == "DataName"].index
            if not data_start_idx.empty:
                data_start_idx = data_start_idx[0] + 1
                cv_vbias = df.iloc[data_start_idx:, 1].replace(' ', '0').sdtype(float).tolist()
                cv_capdata = df.iloc[data_start_idx:, 4].replace(' ', '0').sdtype(float).tolist()
            cv_aclevel = self.utils.find_value_by_keyword(df, "Measurement.Secondary.ACLevel", columns=1)
            cv_frequency = self.utils.find_value_by_keyword(df, "Measurement.Secondary.Frequency", columns=1)
                
            ms_date_value_str = self.utils.extract_date_from_string(condlist[-4])    
            pd_date_value_str = self.utils.extract_date_from_string(condlist[-5])    
            file_data = {
                f"{prefix}_root" : root,
                "mat_name" : cond_list[-1],
                f"{prefix}_ms_equip": cond_list[-8],
                f"{prefix}_pd_equip": cond_list[-6],
                f"{prefix}_pd_date": pd_date_value_str,
                f"{prefix}_ms_date": ms_date_value_str,
                f"{prefix}_device_classification": condlist[-3],
                f"{prefix}_device_structure": cond_list[-2],
                f"{prefix}_aclevel": cv_aclevel,
                f"{prefix}_frequency": cv_frequency,
                f"{prefix}_vbias": cv_vbias,
                f"{prefix}_capdata": cv_capdata,
            }
            
        except Exception as e:
            print(f"failed {file}: {e}")
        return file_data
        
    def plqy_parsing(self, file_type=".all", check_item="ALL", prefix="plqy"):
		parsed_list = []
		for root, file in self.root_files:
			try:
				file_data = self.plqy_parse_file(
					root, file, file_type, check_item, prefix
				)
				parsed_list.append(file_data)
			except Excepttion as e:
				print(f"error processing {file} : {e}")
		return parsed_list, prefix
		
	def plqy_parse_file(self, root, file, file_type=".all", check_item="ALL", prefix="plqy"):
		file_path = os.path.join(root, file)
		cond_list = root.split("/")
		file_data = {}
		
		try:
			if not self.utils.is_valid_extension(file, file_type):
				return {}
			
			df = pd.read_csv(file_path, header=None, delimiter="\t", dtype=str)
			
			if not self.utils.is_valid_content(df, check_item):
				return {}
			
			data_extract_start = self.utils.find_data_extract_start(df)
			if data_extract_start is None:
				return {}
			
			# 메타데이터 추출
			file_data.update({
				f"{prefix}_root": root,
				"mat_name": cond_list[-1],
				f"{prefix}_ms_date": self.utils.extract_date_from_string(cond_list[-2]),
				f"{prefix}_pd_date": self.utils.extract_date_from_string(cond_list[-3]),
				f"{prefix}_pd_equip": cond_list[-4],
				f"{prefix}_ms_equip": cond_list[-5]
			})
			
			sample_num = int(df.iloc[0, 1])
			
			# "Exposure Time" 문자열이 있는 행 찾기
			exposure_time_row = None
			for row in range(6):
				if df.iloc[row, 0] == "Exposure Time":
					exposure_time_row = row
					break
			
			if exposure_time_row is None:
				print(f"'Exposure Time' not found in {file}")
				return {}
			
			cursor_row = exposure_time_row - 1
			
			# total_meas: 0부터 data_extract_start-2까지 "Sample" 단어가 나오는 횟수
			total_meas = 0
			for row in range(data_extract_start - 2):
				for col in range(df.shape[1]):
					cell_value = str(df.iloc[row, col])
					if "Sample" in cell_value:
						total_meas += 1
			
			# 커서 행 데이터 한번만 읽기
			cursor_row_data = df.iloc[cursor_row]
			
			# 커서 값 반복문으로 처리
			for i in range(1, 5):
				col_idx = (total_meas + 1) * (i - 1) + sample_num
				cursor_value = float(re.findall(r"\d+\.\d+", cursor_row_data[col_idx])[0])
				file_data[f"{prefix}_cursor{i}"] = cursor_value
			
			# 스펙트럼 데이터 열 인덱스 계산
			ref_col = 1 + (sample_num - 1) * 2
			sample_col = ref_col + 1
			
			file_data.update({
				f"{prefix}_value": float(df.iloc[12 + (sample_num - 1) * 2, 4]),
				f"{prefix}_wavelength": df.iloc[data_extract_start:, 0].tolist(),
				f"{prefix}_refdata": df.iloc[data_extract_start:, ref_col].tolist(),
				f"{prefix}_sampledata": df.iloc[data_extract_start:, sample_col].tolist()
			})
			
		except Exception as e:
			print(f"failed {file}: {e}")
		
		return file_data
				
        
def parse_run(equipment_name=None):
    parser = DataParsing(os.getcwd())
    utils = ParsingUtils()
    equipment_folders = {
        "ac3" : "AC3",
        "cv" : "CV",
        "iv" : "IV"
    }
    
    if equipment_name:
        folder_name = equipment_folders.get(equipment_name.lower())
        if folder_name:
            if equipment_name.lower() == "cv":
                cv_folder_path = os.path.join(os.getcwd(), "mediafiles", "dvmt", "rawdata", folder_name)
                cv_excel_path = os.path.join(cv_folder_path, "CV_datalist.xlsx")
                utils.prepare_directories(cv_folder_path, cv_excel_path)
                parser.load_cv_device_dict(cv_excel_path)
                parser.parsing(cv_folder_path, True)
            elif equipment_name.lower() == "iv":
                iv_folder_path = os.path.join(os.getcwd(), "mediafiles", "dvmt", "rawdata", folder_name)
                iv_excel_path = os.path.join(iv_folder_path, "IV_datalist.xlsx")
                utils.prepare_directories(iv_folder_path, iv_excel_path)
                parser.load_iv_device_dict(iv_excel_path)
                parser.parsing(iv_folder_path, True)
            else:
                folder_path = os.path.join(os.getcwd(), "mediafiles", "dvmt", "rawdata", folder_name)
                parser.parsing(folder_path, True)
        else:
            # unknown equipment_name, ignore or log
            pass
    else:
        # equipment_name이 None이면 모든 장비 처리
        for key, folder_name in equipment_folders.items():
            folder_path = os.path.join(os.getcwd(), "mediafiles", "dvmt", "rawdata", folder_name)
            if key == "cv":
                cv_excel_path = os.path.join(folder_path, "CV_datalist.xlsx")
                utils.prepare_directories(folder_path, cv_excel_path)
                parser.load_cv_device_dict(cv_excel_path)
            elif key == "iv":
                iv_excel_path = os.path.join(folder_path, "IV_datalist.xlsx")
                utils.prepare_directories(folder_path, iv_excel_path)
                parser.load_iv_device_dict(iv_excel_path)
            # AC3 같은 다른 장비는 Excel 불필요
            parser.parsing(folder_path, True)