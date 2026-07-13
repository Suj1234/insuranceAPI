"""
Parent district mapping: new post-2011 districts -> GADM 4.1 parent district.
Used for NFHS-5 and EM-DAT data which are only available at old district level.

Source: Government of India district reorganisation orders + Census 2011 boundary reference.
"""

# Format: "NewDistrict|State": "GADMParentDistrict"
# GADM parent must exist in district_risk_index

PARENT_MAP = {

    # ── Andaman & Nicobar ────────────────────────────────────────────────────
    "Nicobars|AndamanandNicobar":              "NicobarIslands",
    "NorthAndMiddleAndaman|AndamanandNicobar": "NorthandMiddleAndaman",
    "SouthAndamans|AndamanandNicobar":         "SouthAndaman",

    # ── Andhra Pradesh (reorganised 2022: 13 -> 26 districts) ────────────────
    "AlluriSitharamaRaju|AndhraPradesh":       "Visakhapatnam",
    "Annamayya|AndhraPradesh":                 "Y.S.R.",
    "Bapatla|AndhraPradesh":                   "Guntur",
    "Eluru|AndhraPradesh":                     "WestGodavari",
    "Kakinada|AndhraPradesh":                  "EastGodavari",
    "Konaseema|AndhraPradesh":                 "EastGodavari",
    "Nandyal|AndhraPradesh":                   "Kurnool",
    "Ntr|AndhraPradesh":                       "Krishna",
    "Palnadu|AndhraPradesh":                   "Guntur",
    "ParvathipuramManyam|AndhraPradesh":       "Visakhapatnam",
    "SpsrNellore|AndhraPradesh":               "Nellore",
    "SriSathyaSai|AndhraPradesh":              "Anantapur",
    "Tirupati|AndhraPradesh":                  "Chittoor",
    "Visakhapatanam|AndhraPradesh":            "Visakhapatnam",
    "Y.s.r.|AndhraPradesh":                    "Y.S.R.",

    # ── Arunachal Pradesh ────────────────────────────────────────────────────
    "Leparada|ArunachalPradesh":               "EastSiang",
    "LowerSiang|ArunachalPradesh":             "EastSiang",
    "PakkeKessang|ArunachalPradesh":           "EastKameng",
    "ShiYomi|ArunachalPradesh":                "WestSiang",

    # ── Assam (new districts post-2015) ──────────────────────────────────────
    "Bajali|Assam":                            "Barpeta",
    "Biswanath|Assam":                         "Sonitpur",
    "Charaideo|Assam":                         "Sivasagar",
    "Hojai|Assam":                             "Nagaon",
    "KamrupMetro|Assam":                       "Kamrup",
    "Majuli|Assam":                            "Jorhat",
    "Marigaon|Assam":                          "Nagaon",
    "SouthSalmaraMancachar|Assam":             "Dhubri",
    "WestKarbiAnglong|Assam":                  "KarbiAnglong",

    # ── Bihar ────────────────────────────────────────────────────────────────
    "Kaimur(bhabua)|Bihar":                    "Kaimur",
    "PurbiChamparan|Bihar":                    "PurbaChamparan",

    # ── Chhattisgarh ─────────────────────────────────────────────────────────
    "Gariyaband|Chhattisgarh":                 "Raipur",
    "GaurellaPendraMarwahi|Chhattisgarh":      "Bilaspur",
    "Janjgir-champa|Chhattisgarh":             "Janjgir-Champa",
    "Kabirdham|Chhattisgarh":                  "Kabeerdham",
    "Kanker|Chhattisgarh":                     "Bastar",
    "Korea|Chhattisgarh":                      "Koriya",

    # ── Gujarat ──────────────────────────────────────────────────────────────
    "Arvalli|Gujarat":                         "SabarKantha",
    "Chhotaudepur|Gujarat":                    "Vadodara",
    "Dang|Gujarat":                            "Navsari",
    "Dohad|Gujarat":                           "Dahod",

    # ── Haryana ──────────────────────────────────────────────────────────────
    "CharkiDadri|Haryana":                     "Bhiwani",
    "Nuh|Haryana":                             "Mewat",

    # ── Himachal Pradesh ─────────────────────────────────────────────────────
    "LahulAndSpiti|HimachalPradesh":           "Lahul&Spiti",

    # ── Jammu & Kashmir (now UT, post-2019 reorganisation) ───────────────────
    "Anantnag|JammuandKashmir":                "Anantnag",        # same name, state renamed
    "Bandipora|JammuandKashmir":               "Baramulla",
    "Baramulla|JammuandKashmir":               "Baramulla",
    "Budgam|JammuandKashmir":                  "Srinagar",
    "Doda|JammuandKashmir":                    "Doda",
    "Ganderbal|JammuandKashmir":               "Srinagar",
    "Jammu|JammuandKashmir":                   "Jammu",
    "Kathua|JammuandKashmir":                  "Kathua",
    "Kishtwar|JammuandKashmir":                "Doda",
    "Kulgam|JammuandKashmir":                  "Anantnag",
    "Kupwara|JammuandKashmir":                 "Kupwara",
    "Poonch|JammuandKashmir":                  "Poonch",
    "Pulwama|JammuandKashmir":                 "Pulwama",
    "Rajouri|JammuandKashmir":                 "Rajouri",
    "Ramban|JammuandKashmir":                  "Doda",
    "Reasi|JammuandKashmir":                   "Udhampur",
    "Samba|JammuandKashmir":                   "Jammu",
    "Shopian|JammuandKashmir":                 "Pulwama",
    "Srinagar|JammuandKashmir":                "Srinagar",
    "Udhampur|JammuandKashmir":                "Udhampur",

    # ── Jharkhand ────────────────────────────────────────────────────────────
    "EastSinghbum|Jharkhand":                  "PurbiSinghbhum",
    "Koderma|Jharkhand":                       "Hazaribagh",
    "Sahebganj|Jharkhand":                     "Sahibganj",
    "SaraikelaKharsawan|Jharkhand":            "PashchimiSinghbhum",
    "WestSinghbhum|Jharkhand":                 "PashchimiSinghbhum",

    # ── Karnataka (renamed districts post-2014) ───────────────────────────────
    "Ballari|Karnataka":                       "Bellary",
    "Belagavi|Karnataka":                      "Belgaum",
    "Chamarajanagara|Karnataka":               "Mysore",
    "Chikkaballapura|Karnataka":               "Kolar",
    "Chikkamagaluru|Karnataka":                "Chikmagalur",
    "Davangere|Karnataka":                     "Davanagere",
    "Kalaburagi|Karnataka":                    "Gulbarga",
    "Mysuru|Karnataka":                        "Mysore",
    "Shivamogga|Karnataka":                    "Shimoga",
    "Tumakuru|Karnataka":                      "Tumkur",
    "Vijayapura|Karnataka":                    "Bijapur",
    "Vijaynagar|Karnataka":                    "Bellary",

    # ── Ladakh (new UT 2019) ─────────────────────────────────────────────────
    "Kargil|Ladakh":                           "Kargil",
    "LehLadakh|Ladakh":                        "Leh(Ladakh)",

    # ── Lakshadweep ──────────────────────────────────────────────────────────
    "LakshadweepDistrict|Lakshadweep":         "Lakshadweep",

    # ── Madhya Pradesh ───────────────────────────────────────────────────────
    "Khargone|MadhyaPradesh":                  "WestNimar",
    "Narsinghpur|MadhyaPradesh":               "Narsimhapur",
    "Niwari|MadhyaPradesh":                    "Tikamgarh",

    # ── Maharashtra ──────────────────────────────────────────────────────────
    "Beed|Maharashtra":                        "Bid",
    "Buldhana|Maharashtra":                    "Buldana",
    "Gadchiroli|Maharashtra":                  "Garhchiroli",
    "Gondia|Maharashtra":                      "Gondiya",
    "Raigad|Maharashtra":                      "Raigarh",

    # ── Manipur (new districts 2016) ─────────────────────────────────────────
    "Jiribam|Manipur":                         "ImphalEast",
    "Kakching|Manipur":                        "Thoubal",
    "Kamjong|Manipur":                         "Ukhrul",
    "Kangpokpi|Manipur":                       "Senapati",
    "Noney|Manipur":                           "Tamenglong",
    "Pherzawl|Manipur":                        "Churachandpur",
    "Tengnoupal|Manipur":                      "Chandel",

    # ── Meghalaya ────────────────────────────────────────────────────────────
    "EastJaintiaHills|Meghalaya":              "JaintiaHills",
    "WestJaintiaHills|Meghalaya":              "JaintiaHills",

    # ── Mizoram (new districts 2019) ─────────────────────────────────────────
    "Hnahthial|Mizoram":                       "Lunglei",
    "Khawzawl|Mizoram":                        "Champhai",
    "Lawngtlai|Mizoram":                       "Lawangtlai",
    "Saitual|Mizoram":                         "Aizawl",

    # ── Odisha ───────────────────────────────────────────────────────────────
    "Boudh|Odisha":                            "Bauda",
    "Deogarh|Odisha":                          "Debagarh",
    "Nabarangpur|Odisha":                      "Nabarangapur",
    "Sonepur|Odisha":                          "Subarnapur",

    # ── Puducherry ───────────────────────────────────────────────────────────
    "Pondicherry|Puducherry":                  "Puducherry",

    # ── Punjab ───────────────────────────────────────────────────────────────
    "Firozepur|Punjab":                        "Firozpur",
    "Malerkotla|Punjab":                       "Sangrur",
    "S.a.sNagar|Punjab":                       "SahibzadaAjitSinghNagar",
    "SriMuktsarSahib|Punjab":                  "Muktsar",

    # ── Rajasthan ────────────────────────────────────────────────────────────
    "Chittorgarh|Rajasthan":                   "Chittaurgarh",
    "Dholpur|Rajasthan":                       "Dhaulpur",
    "Jalore|Rajasthan":                        "Jalor",
    "Jhunjhunu|Rajasthan":                     "Jhunjhunun",

    # ── Sikkim (renamed 2022) ────────────────────────────────────────────────
    "EastDistrict|Sikkim":                     "EastSikkim",
    "NorthDistrict|Sikkim":                    "NorthSikkim",
    "Pakyong|Sikkim":                          "EastSikkim",
    "SouthDistrict|Sikkim":                    "SouthSikkim",
    "WestDistrict|Sikkim":                     "WestSikkim",

    # ── Tamil Nadu (new districts 2022) ──────────────────────────────────────
    "Chengalpattu|TamilNadu":                  "Kancheepuram",
    "Kallakurichi|TamilNadu":                  "Viluppuram",
    "Kanchipuram|TamilNadu":                   "Kancheepuram",
    "Mayiladuthurai|TamilNadu":                "Nagappattinam",
    "Nagapattinam|TamilNadu":                  "Nagappattinam",
    "Ranipet|TamilNadu":                       "Vellore",
    "Tenkasi|TamilNadu":                       "Tirunelveli",
    "Tirupathur|TamilNadu":                    "Vellore",
    "Tuticorin|TamilNadu":                     "Thoothukkudi",
    "Villupuram|TamilNadu":                    "Viluppuram",
    "Virudhunagar|TamilNadu":                  "Virudunagar",

    # ── Telangana (new state 2014, new districts 2016) ───────────────────────
    "BhadradriKothagudem|Telangana":           "Khammam",
    "Hanumakonda|Telangana":                   "Warangal",
    "Jagitial|Telangana":                      "Karimnagar",
    "Jangoan|Telangana":                       "Warangal",
    "JayashankarBhupalapally|Telangana":       "Warangal",
    "JogulambaGadwal|Telangana":               "Mahbubnagar",
    "Kamareddy|Telangana":                     "Nizamabad",
    "KumuramBheemAsifabad|Telangana":          "Adilabad",
    "Mahabubabad|Telangana":                   "Warangal",
    "Mahabubnagar|Telangana":                  "Mahbubnagar",
    "Mancherial|Telangana":                    "Adilabad",
    "MedchalMalkajgiri|Telangana":             "RangaReddy",
    "Mulugu|Telangana":                        "Warangal",
    "Nagarkurnool|Telangana":                  "Mahbubnagar",
    "Narayanpet|Telangana":                    "Mahbubnagar",
    "Nirmal|Telangana":                        "Adilabad",
    "Peddapalli|Telangana":                    "Karimnagar",
    "RajannaSircilla|Telangana":               "Karimnagar",
    "Sangareddy|Telangana":                    "Medak",
    "Siddipet|Telangana":                      "Medak",
    "Suryapet|Telangana":                      "Nalgonda",
    "Vikarabad|Telangana":                     "RangaReddy",
    "Wanaparthy|Telangana":                    "Mahbubnagar",
    "YadadriBhuvanagiri|Telangana":            "Nalgonda",

    # ── Dadra & Nagar Haveli + Daman & Diu (merged UT 2020) ─────────────────
    "DadraAndNagarHaveli|TheDadraAndNagarHaveliAndDamanAndDiu": "DadraandNagarHaveli",
    "Daman|TheDadraAndNagarHaveliAndDamanAndDiu":               "Daman",
    "Diu|TheDadraAndNagarHaveliAndDamanAndDiu":                 "Diu",

    # ── Tripura (new districts 2012) ─────────────────────────────────────────
    "Sepahijala|Tripura":                      "WestTripura",
    "Unakoti|Tripura":                         "NorthTripura",

    # ── Uttar Pradesh ────────────────────────────────────────────────────────
    "Bhadohi|UttarPradesh":                    "SantRaviDasNagar",
    "Kheri|UttarPradesh":                      "Lakhimpur",
    "KushiNagar|UttarPradesh":                 "Kushinagar",
    "Prayagraj|UttarPradesh":                  "Allahabad",
    "SantKabeerNagar|UttarPradesh":            "Basti",

    # ── Uttarakhand ──────────────────────────────────────────────────────────
    "Haridwar|Uttarakhand":                    "Hardwar",
    "PauriGarhwal|Uttarakhand":                "Garhwal",
    "RudraPrayag|Uttarakhand":                 "Rudraprayag",
    "UdamSinghNagar|Uttarakhand":              "UdhamSinghNagar",
    "UttarKashi|Uttarakhand":                  "Uttarkashi",

    # ── West Bengal ──────────────────────────────────────────────────────────
    "Coochbehar|WestBengal":                   "KochBihar",
    "Darjeeling|WestBengal":                   "Darjiling",
    "DinajpurDakshin|WestBengal":              "DakshinDinajpur",
    "DinajpurUttar|WestBengal":                "UttarDinajpur",
    "Hooghly|WestBengal":                      "Hugli",
    "Howrah|WestBengal":                       "Haora",
    "Jhargram|WestBengal":                     "PashchimMedinipur",
    "Kalimpong|WestBengal":                    "Darjiling",
    "MedinipurEast|WestBengal":                "PurbaMedinipur",
    "MedinipurWest|WestBengal":                "PashchimMedinipur",
    "PaschimBardhaman|WestBengal":             "Barddhaman",
    "PurbaBardhaman|WestBengal":               "Barddhaman",
    "Purulia|WestBengal":                      "Puruliya",
}


if __name__ == "__main__":
    # Validate: check every parent exists in district_risk_index
    import psycopg2, os

    with open('.env.local') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    missing_parents = []
    for key, parent in PARENT_MAP.items():
        new_dist, state = key.split('|')
        # normalise state name for lookup
        cur.execute(
            'SELECT 1 FROM district_risk_index WHERE district_name = %s',
            (parent,)
        )
        if not cur.fetchone():
            missing_parents.append(f'{new_dist}/{state} -> {parent} (PARENT NOT FOUND)')

    conn.close()

    if missing_parents:
        print(f'WARNING: {len(missing_parents)} parents not found in district_risk_index:')
        for m in missing_parents:
            print(f'  {m}')
    else:
        print(f'All {len(PARENT_MAP)} parent mappings validated OK.')
