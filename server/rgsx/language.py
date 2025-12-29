import json
import os
import logging
from . import config

logger = logging.getLogger(__name__)
translations = {}

def initialize_language():
    global translations
    try:
        lang_file = os.path.join(config.LANGUAGES_FOLDER, "en.json")
        if os.path.exists(lang_file):
            with open(lang_file, "r", encoding="utf-8") as f:
                translations = json.load(f)
    except Exception as e:
        logger.error(f"Error loading language: {e}")

def _(key):
    return translations.get(key, key)
