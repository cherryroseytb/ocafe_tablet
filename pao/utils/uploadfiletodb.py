def check_j(expt):
	expt_j_list = [item["J(mA/cm2)"] for item in expt]
	len_jvalue = len(expt_j_list)
	check_jvalue = all(9.5 <= item <= 10.5 for item in expt_j_list)
	return len_jvalue, check_jvalue

def upload_doe(request, file, model_name) -> typle[list, dict]:
    response_data = {}
    OC3_list_Path = (settings.BASE_DIR / "core" / static("~~~.xlsx")[1:])
    doe = DOE_Parser(input_file_name=file, OC3_list_Path=OC3_list_Path, model_name=model_name)
    clean_doe, _ = doe.load_deo_file()
    clean_doe_df = clean_doe.drop(columns=["~"])
    new_order = [
        "Product_Type",
        "Model",
        "Sequence",
        "Exp_Date",
        "~"]
    clean_doe_df = clean_doe_df[new_order]
    doe_file_data, response_data = assign_doe(clean_doe_df)
    if doe_file_data:
        try:
            with transacton.atomic():
                doe_file_data = list(
                    map(lambda x: auto_field(request, x), doe_file_data))
                
                product_type = request.POST.get("product_type", DOE.ProductTypeChoices.PO)
                for instance in doe_file_data:
                    instance.product_type = product_type
                
                DOE.objects.bulk_create(doe_file_data, batch_size=1000)
                for doe in doe_file_data:
                    parse_doe_structure_and_create_all(doe)
        except Exception as e:
            ~
    return response_data
    

def parse_doe_structure_and_create_all(doe):
    structure_dict = doe.structure
    structure_list = [dict(v) for _, v in structure_dict.items()]
    
    for item in structure_list:
        material, _ = Material.........
        
        
def auto_field(request, instance) -> base.ModelBase:
    instance.ip = request.META["~"]
    instance.created_at = timezone.now()
    instance.created_user = request.created_user
    return instance
    
    
clean_doe_df = clean_doe.drop(columns=["~"])

# ✅ 먼저 product_type 값을 가져온다
product_type = request.POST.get("product_type", DOE.ProductTypeChoices.PO)

# ✅ DataFrame에 product_type 컬럼을 추가
clean_doe_df["Product_Type"] = product_type  # 모든 row에 동일한 값으로 삽입

# ✅ 이제야 new_order 정렬 가능
new_order = [
    "Product_Type",
    "Model",
    "Sequence",
    "Exp_Date",
    "~"
]
clean_doe_df = clean_doe_df[new_order]



def upload_ivl_to_dataframe(file, product_type) -> Union[pd.DataFrame, dict[str]]:
	ivl = IVL_Parser(file, product_type=product_type)
	
	#error_msg 부분 생략
	
	file_name = file.name
	ivl_id = ivl.sw_df_c["fname"][0]
	expt_data = ivl.sw_df_c.drop(columns=["fname"])
	
	if product_type == "TV":
		expt_data = expt_data.astype({
			# 세부 항목 생략
		})
	else:
		expt_data = expt_data.astype({
			# 세부 항목 생략
		})
		
	expt_spec = expt_data.pop("spectrum")
	expt_spec = expt_spec.astype({"spectrum": "object"}).dropna()
	
	ivl_df = pd.DataFrame([{
		"file_name": file_name,
		"ivl_id": ivl_id,
		"expt": expt_data,
		"expt_spec": expt_spec
	}])
	
	return ivl_df
	
	
def assign_ivl(ivl_df, folder_date: str, product_type) -> typle[object, dict]:
	json_data = ivl_df.to_json(orient="records", indent=4)
	ivl_file = json.loads(json_data)[0]
	
	ivl_id = ivl_file["ivl_id"]
	file_name = ivl_file["file_name"]
	expt = ivl_file["expt"]
	expt_spec = ivl_file["expt_spec"]
	
	len_jvalue, check_jvalue = check_j(expt)
	if len_jvalue == 5 and check_jvalue:
		return None, {
			"status": "secondary",
			"message": "시야각 파일입니다."
		}
	
	color, lot, gls = ivl_id.split("_")[:-1]
	try:
		# DOE 인스턴스 조회 생략 (if-else)
		if IVL.objects.filter(
			ivl_id=ivl_id,
			doe_id=doe_instance.pk
		).exists():
			logger.error(f"{ivl_id}가 중복입니다.")
			return None, {"status": "secondary", "message": f"{ivl_id} 중복"}
		
		ivl = IVL(
			ivl_id=ivl_id,
			filename=file_name,
			expt=expt,
			expt_spec=expt_spec,
			doe_id=doe_instance.pk
		)
		ivl.is_J10 = ivl.check_is_J10
		
		response_data = {"status": "success", "message": "업로드 완료"}
		return ivl, response_data
		
	except ObjectDoesNotExist:
		return None, {"status": "secondary", "message": "관련 runsheet 없음"}
		