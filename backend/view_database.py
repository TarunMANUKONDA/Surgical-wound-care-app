#!/usr/bin/env python3
"""
Simple database viewer for the Wound Care SQLite database
Run this script to view all data in the database
"""

import sqlite3
from datetime import datetime
import json

DB_PATH = "wound_care.db"

def view_all_data():
    """Display all data from the database"""
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row  # Access columns by name
        cursor = conn.cursor()
        
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        
        print("=" * 80)
        print(f"DATABASE: {DB_PATH}")
        print(f"Retrieved at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)
        print()
        
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            
            print(f"\n📊 TABLE: {table} ({count} records)")
            print("-" * 80)
            
            if count > 0:
                cursor.execute(f"SELECT * FROM {table}")
                rows = cursor.fetchall()
                
                # Get column names
                columns = [description[0] for description in cursor.description]
                
                # Print header
                print(" | ".join(columns))
                print("-" * 80)
                
                # Print rows
                for row in rows:
                    values = []
                    for i, col in enumerate(columns):
                        value = row[i]
                        # Format JSON fields
                        if col in ['all_probabilities', 'tissue_composition', 'analysis', 
                                   'cleaning_instructions', 'dressing_recommendations']:
                            if value:
                                try:
                                    value = json.dumps(json.loads(value) if isinstance(value, str) else value, indent=2)
                                except:
                                    pass
                        # Truncate long values
                        value_str = str(value)[:50] if value else "NULL"
                        values.append(value_str)
                    
                    print(" | ".join(values))
            
            print()
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
    except FileNotFoundError:
        print(f"❌ Database file not found: {DB_PATH}")
        print("   Make sure you've started the backend server at least once!")

if __name__ == "__main__":
    view_all_data()
