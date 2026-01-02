from django.core.management.base import BaseCommand
from dvmt.utils.data_parsing import DataParsing, parse_run
import os

class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument("equipment", nargs="?", default=None)
        
    def handle(self, *args, **options):
        equipment = options["equipment"]
        folder_path = os.path.join(os.getcwd(), "mediafiles", "dvmt", "rawdata")
        parser = DataParsing(folder_path)
        
        if equipment and equipment.lower() == "material":
            parser.parse_material_file()
        elif equipment and equipment.lower() == "all":
            parser.parse_material_file()
            parse_run()
        else:
            parse_run(equipment)
