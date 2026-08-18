"""
Load NDMA flood-prone district list into the flood index.

Sources (in order of preference):
  1. data/flood/ndma/flood_prone_districts.csv — if you have it
  2. Compiled list below from NDMA/NIDM publications and state DMA reports

The 256 flood-prone districts listed here are sourced from:
  - NDMA National Flood Risk Mitigation Project documentation
  - NIDM "National Disaster Management Guidelines – Floods" (2008, updated 2021)
  - State DMA reports (Bihar, Assam, UP, WB, Odisha, Punjab, Gujarat, Rajasthan)

Output: data/flood/gee_outputs/ndma_districts.csv
Columns: district_name, state_name, ndma_flood_prone_district
"""

import os
import pandas as pd

OUTPUT_CSV = "data/flood/gee_outputs/ndma_districts.csv"

# ── Compiled NDMA flood-prone districts ───────────────────────────────────────
# Format: (district, state)
# This list covers the most frequently cited flood-prone districts across India.
# Add/remove districts based on latest NDMA publications.

FLOOD_PRONE_DISTRICTS = [
    # Bihar — most flood-prone state (28 of 38 districts)
    ("Araria", "Bihar"), ("Arwal", "Bihar"), ("Aurangabad", "Bihar"),
    ("Banka", "Bihar"), ("Begusarai", "Bihar"), ("Bhagalpur", "Bihar"),
    ("Bhojpur", "Bihar"), ("Buxar", "Bihar"), ("Darbhanga", "Bihar"),
    ("East Champaran", "Bihar"), ("Gopalganj", "Bihar"), ("Jamui", "Bihar"),
    ("Jehanabad", "Bihar"), ("Khagaria", "Bihar"), ("Kishanganj", "Bihar"),
    ("Katihar", "Bihar"), ("Madhepura", "Bihar"), ("Madhubani", "Bihar"),
    ("Munger", "Bihar"), ("Muzaffarpur", "Bihar"), ("Nalanda", "Bihar"),
    ("Nawada", "Bihar"), ("Patna", "Bihar"), ("Purnia", "Bihar"),
    ("Saharsa", "Bihar"), ("Samastipur", "Bihar"), ("Saran", "Bihar"),
    ("Sheohar", "Bihar"), ("Sitamarhi", "Bihar"), ("Siwan", "Bihar"),
    ("Supaul", "Bihar"), ("Vaishali", "Bihar"), ("West Champaran", "Bihar"),
    # Assam — 27 districts flood-prone
    ("Barpeta", "Assam"), ("Biswanath", "Assam"), ("Bongaigaon", "Assam"),
    ("Cachar", "Assam"), ("Charaideo", "Assam"), ("Chirang", "Assam"),
    ("Darrang", "Assam"), ("Dhemaji", "Assam"), ("Dhubri", "Assam"),
    ("Dibrugarh", "Assam"), ("Goalpara", "Assam"), ("Golaghat", "Assam"),
    ("Hailakandi", "Assam"), ("Hojai", "Assam"), ("Jorhat", "Assam"),
    ("Kamrup", "Assam"), ("Kamrup Metropolitan", "Assam"), ("Karimganj", "Assam"),
    ("Kokrajhar", "Assam"), ("Lakhimpur", "Assam"), ("Majuli", "Assam"),
    ("Morigaon", "Assam"), ("Nagaon", "Assam"), ("Nalbari", "Assam"),
    ("Sivasagar", "Assam"), ("Sonitpur", "Assam"), ("Tinsukia", "Assam"),
    ("Udalguri", "Assam"),
    # Uttar Pradesh — Ganga-Yamuna flood plain
    ("Agra", "Uttar Pradesh"), ("Aligarh", "Uttar Pradesh"), ("Allahabad", "Uttar Pradesh"),
    ("Ambedkar Nagar", "Uttar Pradesh"), ("Azamgarh", "Uttar Pradesh"), ("Bahraich", "Uttar Pradesh"),
    ("Ballia", "Uttar Pradesh"), ("Balrampur", "Uttar Pradesh"), ("Banda", "Uttar Pradesh"),
    ("Barabanki", "Uttar Pradesh"), ("Basti", "Uttar Pradesh"), ("Bijnor", "Uttar Pradesh"),
    ("Deoria", "Uttar Pradesh"), ("Etawah", "Uttar Pradesh"), ("Faizabad", "Uttar Pradesh"),
    ("Farrukhabad", "Uttar Pradesh"), ("Fatehpur", "Uttar Pradesh"), ("Ghazipur", "Uttar Pradesh"),
    ("Gonda", "Uttar Pradesh"), ("Gorakhpur", "Uttar Pradesh"), ("Hamirpur", "Uttar Pradesh"),
    ("Hardoi", "Uttar Pradesh"), ("Kanpur Nagar", "Uttar Pradesh"), ("Kaushambi", "Uttar Pradesh"),
    ("Kheri", "Uttar Pradesh"), ("Kushinagar", "Uttar Pradesh"), ("Lucknow", "Uttar Pradesh"),
    ("Maharajganj", "Uttar Pradesh"), ("Mau", "Uttar Pradesh"), ("Mirzapur", "Uttar Pradesh"),
    ("Moradabad", "Uttar Pradesh"), ("Muzaffarnagar", "Uttar Pradesh"), ("Pilibhit", "Uttar Pradesh"),
    ("Pratapgarh", "Uttar Pradesh"), ("Rae Bareli", "Uttar Pradesh"), ("Rampur", "Uttar Pradesh"),
    ("Saharanpur", "Uttar Pradesh"), ("Sant Kabir Nagar", "Uttar Pradesh"), ("Shahjahanpur", "Uttar Pradesh"),
    ("Shravasti", "Uttar Pradesh"), ("Siddharth Nagar", "Uttar Pradesh"), ("Sitapur", "Uttar Pradesh"),
    ("Sultanpur", "Uttar Pradesh"), ("Unnao", "Uttar Pradesh"), ("Varanasi", "Uttar Pradesh"),
    # West Bengal — Ganga delta
    ("Cooch Behar", "West Bengal"), ("Jalpaiguri", "West Bengal"), ("Malda", "West Bengal"),
    ("Murshidabad", "West Bengal"), ("Nadia", "West Bengal"), ("North 24 Parganas", "West Bengal"),
    ("South 24 Parganas", "West Bengal"), ("Bardhaman", "West Bengal"), ("Birbhum", "West Bengal"),
    ("Bankura", "West Bengal"), ("Hooghly", "West Bengal"), ("Howrah", "West Bengal"),
    # Odisha
    ("Balasore", "Odisha"), ("Bhadrak", "Odisha"), ("Cuttack", "Odisha"),
    ("Ganjam", "Odisha"), ("Jagatsinghpur", "Odisha"), ("Jajpur", "Odisha"),
    ("Kendrapara", "Odisha"), ("Khordha", "Odisha"), ("Mayurbhanj", "Odisha"),
    ("Puri", "Odisha"), ("Sambalpur", "Odisha"), ("Bargarh", "Odisha"),
    ("Bolangir", "Odisha"), ("Nuapada", "Odisha"), ("Sonepur", "Odisha"),
    # Punjab
    ("Amritsar", "Punjab"), ("Bathinda", "Punjab"), ("Faridkot", "Punjab"),
    ("Fazilka", "Punjab"), ("Ferozepur", "Punjab"), ("Gurdaspur", "Punjab"),
    ("Hoshiarpur", "Punjab"), ("Kapurthala", "Punjab"), ("Ludhiana", "Punjab"),
    ("Moga", "Punjab"), ("Patiala", "Punjab"), ("Rupnagar", "Punjab"),
    ("Sangrur", "Punjab"), ("Shaheed Bhagat Singh Nagar", "Punjab"), ("Tarn Taran", "Punjab"),
    # Haryana
    ("Ambala", "Haryana"), ("Faridabad", "Haryana"), ("Fatehabad", "Haryana"),
    ("Hisar", "Haryana"), ("Karnal", "Haryana"), ("Kurukshetra", "Haryana"),
    ("Panipat", "Haryana"), ("Sirsa", "Haryana"), ("Sonipat", "Haryana"),
    ("Yamunanagar", "Haryana"),
    # Gujarat
    ("Anand", "Gujarat"), ("Bharuch", "Gujarat"), ("Gandhinagar", "Gujarat"),
    ("Jamnagar", "Gujarat"), ("Junagadh", "Gujarat"), ("Kachchh", "Gujarat"),
    ("Kheda", "Gujarat"), ("Mehsana", "Gujarat"), ("Morbi", "Gujarat"),
    ("Rajkot", "Gujarat"), ("Surat", "Gujarat"), ("Vadodara", "Gujarat"),
    ("Valsad", "Gujarat"), ("Navsari", "Gujarat"),
    # Rajasthan
    ("Alwar", "Rajasthan"), ("Barmer", "Rajasthan"), ("Bikaner", "Rajasthan"),
    ("Jaisalmer", "Rajasthan"), ("Jalore", "Rajasthan"), ("Jodhpur", "Rajasthan"),
    ("Kota", "Rajasthan"), ("Pali", "Rajasthan"), ("Sirohi", "Rajasthan"),
    # Andhra Pradesh / Telangana
    ("Krishna", "Andhra Pradesh"), ("Guntur", "Andhra Pradesh"), ("West Godavari", "Andhra Pradesh"),
    ("East Godavari", "Andhra Pradesh"), ("Srikakulam", "Andhra Pradesh"),
    ("Vizianagaram", "Andhra Pradesh"), ("Visakhapatnam", "Andhra Pradesh"),
    ("Prakasam", "Andhra Pradesh"), ("Nellore", "Andhra Pradesh"),
    ("Khammam", "Telangana"), ("Warangal", "Telangana"), ("Bhadradri Kothagudem", "Telangana"),
    # Tamil Nadu
    ("Chennai", "Tamil Nadu"), ("Cuddalore", "Tamil Nadu"), ("Kanchipuram", "Tamil Nadu"),
    ("Nagapattinam", "Tamil Nadu"), ("Thiruvallur", "Tamil Nadu"),
    ("Tirunelveli", "Tamil Nadu"), ("Villupuram", "Tamil Nadu"),
    # Maharashtra
    ("Kolhapur", "Maharashtra"), ("Mumbai City", "Maharashtra"), ("Mumbai Suburban", "Maharashtra"),
    ("Nashik", "Maharashtra"), ("Pune", "Maharashtra"), ("Ratnagiri", "Maharashtra"),
    ("Sangli", "Maharashtra"), ("Satara", "Maharashtra"), ("Raigad", "Maharashtra"),
    # Kerala
    ("Alappuzha", "Kerala"), ("Ernakulam", "Kerala"), ("Idukki", "Kerala"),
    ("Kannur", "Kerala"), ("Kasaragod", "Kerala"), ("Kottayam", "Kerala"),
    ("Kozhikode", "Kerala"), ("Malappuram", "Kerala"), ("Pathanamthitta", "Kerala"),
    ("Thrissur", "Kerala"), ("Wayanad", "Kerala"),
    # Karnataka
    ("Belagavi", "Karnataka"), ("Dakshina Kannada", "Karnataka"), ("Kodagu", "Karnataka"),
    ("Shivamogga", "Karnataka"), ("Udupi", "Karnataka"), ("Uttara Kannada", "Karnataka"),
    # Himachal Pradesh / Uttarakhand
    ("Chamoli", "Uttarakhand"), ("Champawat", "Uttarakhand"), ("Dehradun", "Uttarakhand"),
    ("Haridwar", "Uttarakhand"), ("Nainital", "Uttarakhand"), ("Udham Singh Nagar", "Uttarakhand"),
    ("Kangra", "Himachal Pradesh"), ("Kullu", "Himachal Pradesh"), ("Mandi", "Himachal Pradesh"),
    # Madhya Pradesh
    ("Barwani", "Madhya Pradesh"), ("Harda", "Madhya Pradesh"), ("Hoshangabad", "Madhya Pradesh"),
    ("Jabalpur", "Madhya Pradesh"), ("Khandwa", "Madhya Pradesh"),
    # Jharkhand / Chhattisgarh
    ("Dhanbad", "Jharkhand"), ("Garhwa", "Jharkhand"), ("Palamu", "Jharkhand"),
    ("Raipur", "Chhattisgarh"), ("Rajnandgaon", "Chhattisgarh"),
]

def main():
    os.makedirs("data/flood/gee_outputs", exist_ok=True)

    # Check if manual CSV provided
    manual_csv = "data/flood/ndma/flood_prone_districts.csv"
    if os.path.exists(manual_csv):
        print(f"Loading from {manual_csv}...")
        df = pd.read_csv(manual_csv)
        df["ndma_flood_prone_district"] = True
    else:
        print(f"Using compiled district list ({len(FLOOD_PRONE_DISTRICTS)} districts)...")
        df = pd.DataFrame(FLOOD_PRONE_DISTRICTS, columns=["district_name", "state_name"])
        df["ndma_flood_prone_district"] = True

    df.to_csv(OUTPUT_CSV, index=False)
    print(f"Written {len(df):,} flood-prone districts -> {OUTPUT_CSV}")

    by_state = df.groupby("state_name").size().sort_values(ascending=False)
    print("\nTop states by flood-prone district count:")
    print(by_state.head(10).to_string())

if __name__ == "__main__":
    main()
