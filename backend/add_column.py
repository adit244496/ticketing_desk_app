import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine
import urllib.parse
from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "hospi_desk")

encoded_password = urllib.parse.quote_plus(DB_PASSWORD)
DATABASE_URL = f"postgresql+pg8000://{DB_USER}:{encoded_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE logs ADD COLUMN attachment TEXT;"))
        conn.commit()
        print("Successfully added 'attachment' column to logs table.")
except Exception as e:
    print(f"Error: {e}")
