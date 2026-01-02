def load_json_file(json_file_path, user, ip_address, model_class):
    try:
        with open(json_file_path, 'r') as file:
            data_list = json.load(file)
            
        for data in data_list:
            instance = model_class.from_dict(data, user, ip_address)
            
            if model_class.__name__ == 'UVVISMeas':
                if model_class.objects.filter(sample=instance.sample).exists():
                    
                    instance.save()
                     
            if model_class.__name__ == 'PLQYMeas' ans 'plqy_value' in data:
                cal_value = float(data['plqy_value'])
                fitting_result, created = Fittingresult.objects.get_or_create(
                    # mat_name = instance.sample.material.mat_name,
                    # pd_equip = instance.sample.pd_equip,
                    sample=sample,
                    defaults={
                        # 'sample':instance.sample,
                        'created_by' : instance.created_by,
                        'plqy_value' : cal_value,
                    })
                if not created:
                    fitting_result.plqy_value = cal_value
                    fitting_result.save(update_fields=['plqy_value'])
                    
    except Exception as e:
        print(f'Error loading JSON file {json_file_path}: {e}')