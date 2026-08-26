// Districts of every Indian State and Union Territory.
//
// Source: "India: States, Union Territories & Districts — 2026 reference list",
// itself compiled from the National Portal of India, the Integrated Government
// Online Directory (NIC, August 2026) and the Government of Ladakh's 27 April
// 2026 notification creating five new districts. 787 district entries across 28
// states and 8 union territories.
//
// This list is AUTHORITATIVE for the app: where a state appears here it is used
// for the district dropdown, in preference to live OpenStreetMap admin
// boundaries. OSM lags real administrative change badly — it was missing
// Ramanagara entirely and still used retired names like "Shimoga" — and only
// Karnataka was curated before, so every other state was showing whatever OSM
// happened to have.
//
// District names are matched with @/lib/district-match, which folds spelling
// variants ("Bagalkot" / "Bagalkote") without merging genuinely different
// districts, so a catalogue place spelled the other way still resolves.
//
// Administrative change is continuous — treat this as a 2026 reference and
// re-check against IGOD before relying on it for anything legal or official.
export const INDIA_DISTRICTS: Record<string, string[]> = {
  // ── States ────────────────────────────────────────────────────────────────
  "Andhra Pradesh": [
    "Alluri Sitharama Raju", "Anakapalli", "Ananthapuramu", "Annamayya", "Bapatla",
    "Chittoor", "Dr. B.R. Ambedkar Konaseema", "East Godavari", "Eluru", "Guntur",
    "Kakinada", "Krishna", "Kurnool", "Nandyal", "NTR", "Palnadu",
    "Parvathipuram Manyam", "Prakasam", "Sri Potti Sriramulu Nellore",
    "Sri Sathya Sai", "Srikakulam", "Tirupati", "Visakhapatnam", "Vizianagaram",
    "West Godavari", "YSR Kadapa", "Polavaram", "Markapuram",
  ],
  "Arunachal Pradesh": [
    "Anjaw", "Bichom", "Changlang", "Dibang Valley", "East Kameng", "East Siang",
    "Kamle", "Keyi Panyor", "Kra Daadi", "Kurung Kumey", "Lepa Rada", "Lohit",
    "Longding", "Lower Dibang Valley", "Lower Siang", "Lower Subansiri", "Namsai",
    "Pakke Kessang", "Papum Pare", "Shi Yomi", "Siang", "Tawang", "Tirap",
    "Upper Siang", "Upper Subansiri",
  ],
  Assam: [
    "Bajali", "Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar", "Charaideo",
    "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh", "Dima Hasao",
    "Goalpara", "Golaghat", "Hailakandi", "Hojai", "Jorhat", "Kamrup",
    "Kamrup Metropolitan", "Karbi Anglong", "Kokrajhar", "Lakhimpur", "Majuli",
    "Marigaon", "Morigaon", "Nagaon", "Nalbari", "Sivasagar", "Sonitpur",
    "South Salmara-Mankachar", "Tamulpur", "Tinsukia", "Udalguri",
    "West Karbi Anglong",
  ],
  Bihar: [
    "Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur",
    "Buxar", "Darbhanga", "Gaya", "Gopalganj", "Jamui", "Jehanabad",
    "Kaimur (Bhabua)", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai",
    "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada",
    "Pashchim Champaran", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur",
    "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali",
    "Purba Champaran",
  ],
  Chhattisgarh: [
    "Balod", "Baloda Bazar-Bhatapara", "Balrampur-Ramanujganj", "Bastar",
    "Bemetara", "Bijapur", "Bilaspur", "Dakshin Bastar Dantewada", "Dhamtari",
    "Durg", "Gariyaband", "Gaurela-Pendra-Marwahi", "Janjgir-Champa", "Jashpur",
    "Kabeerdham", "Khairagarh-Chhuikhadan-Gandai", "Kondagaon", "Korba", "Korea",
    "Mahasamund", "Manendragarh-Chirmiri-Bharatpur",
    "Mohla-Manpur-Ambagarh Chouki", "Mungeli", "Narayanpur", "Raigarh", "Raipur",
    "Rajnandgaon", "Sakti", "Sarangarh-Bilaigarh", "Sukma", "Surajpur", "Surguja",
    "Kanker",
  ],
  Goa: ["North Goa", "South Goa", "Kushavati"],
  Gujarat: [
    "Ahmedabad", "Amreli", "Anand", "Aravalli", "Banas Kantha", "Bharuch",
    "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod", "Dang", "Devbhumi Dwarka",
    "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kachchh", "Kheda",
    "Mahisagar", "Mahesana", "Morbi", "Narmada", "Navsari", "Panchmahal", "Patan",
    "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar", "Tapi",
    "Vadodara", "Valsad", "Vav-Tharad",
  ],
  Haryana: [
    "Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram",
    "Hansi", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra",
    "Mahendragarh", "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak",
    "Sirsa", "Sonipat", "Yamunanagar",
  ],
  "Himachal Pradesh": [
    "Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur", "Kullu",
    "Lahaul and Spiti", "Mandi", "Shimla", "Sirmaur", "Solan", "Una",
  ],
  Jharkhand: [
    "Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum", "Garhwa",
    "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara", "Khunti", "Koderma",
    "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahibganj",
    "Seraikela-Kharsawan", "Simdega", "West Singhbhum",
  ],
  Karnataka: [
    "Bagalkote", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru South",
    "Bengaluru Urban", "Bidar", "Chamarajanagar", "Chikkaballapura",
    "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davanagere", "Dharwad",
    "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal",
    "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga", "Tumakuru",
    "Udupi", "Uttara Kannada", "Vijayapura", "Yadgir",
  ],
  Kerala: [
    "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam",
    "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta",
    "Thiruvananthapuram", "Thrissur", "Wayanad",
  ],
  "Madhya Pradesh": [
    "Agar-Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani",
    "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur", "Chhindwara", "Damoh",
    "Datia", "Dewas", "Dhar", "Dindori", "Guna", "Gwalior", "Harda", "Indore",
    "Jabalpur", "Jhabua", "Katni", "Khandwa", "Khargone", "Maihar", "Mandla",
    "Mandsaur", "Mauganj", "Morena", "Narmadapuram", "Narsinghpur", "Neemuch",
    "Niwari", "Pandhurna", "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa",
    "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur",
    "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain", "Umaria", "Vidisha",
  ],
  Maharashtra: [
    "Ahilyanagar", "Akola", "Amravati", "Beed", "Bhandara", "Buldhana",
    "Chandrapur", "Chhatrapati Sambhajinagar", "Dharashiv", "Dhule", "Gadchiroli",
    "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City",
    "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Palghar",
    "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg",
    "Solapur", "Thane", "Wardha", "Washim", "Yavatmal",
  ],
  Manipur: [
    "Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West",
    "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney", "Pherzawl", "Senapati",
    "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul",
  ],
  Meghalaya: [
    "East Garo Hills", "East Jaintia Hills", "East Khasi Hills",
    "Eastern West Khasi Hills", "North Garo Hills", "Ri Bhoi", "South Garo Hills",
    "South West Garo Hills", "South West Khasi Hills", "West Garo Hills",
    "West Jaintia Hills", "West Khasi Hills",
  ],
  Mizoram: [
    "Aizawl", "Champhai", "Hnahthial", "Khawzawl", "Kolasib", "Lawngtlai",
    "Lunglei", "Mamit", "Saitual", "Serchhip", "Siaha",
  ],
  Nagaland: [
    "Chumoukedima", "Dimapur", "Kiphire", "Kohima", "Longleng", "Meluri",
    "Mokokchung", "Mon", "Niuland", "Noklak", "Peren", "Phek", "Shamator",
    "Tseminyu", "Tuensang", "Wokha", "Zunheboto",
  ],
  Odisha: [
    "Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh", "Cuttack",
    "Deogarh", "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghapur", "Jajpur",
    "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar", "Khordha",
    "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada",
    "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundargarh",
  ],
  Punjab: [
    "Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka",
    "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana",
    "Malerkotla", "Mansa", "Moga", "Pathankot", "Patiala", "Rupnagar",
    "S.A.S. Nagar", "Sangrur", "Shahid Bhagat Singh Nagar", "Sri Muktsar Sahib",
    "Tarn Taran",
  ],
  Rajasthan: [
    "Ajmer", "Alwar", "Balotra", "Banswara", "Baran", "Barmer", "Beawar",
    "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa",
    "Deeg", "Dholpur", "Didwana-Kuchaman", "Dungarpur", "Ganganagar",
    "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu",
    "Jodhpur", "Karauli", "Kota", "Kotputli-Behror", "Khairthal-Tijara", "Nagaur",
    "Pali", "Phalodi", "Pratapgarh", "Rajsamand", "Salumbar", "Sawai Madhopur",
    "Sikar", "Sirohi", "Tonk", "Udaipur",
  ],
  Sikkim: ["Gangtok", "Gyalshing", "Mangan", "Namchi", "Pakyong", "Soreng"],
  "Tamil Nadu": [
    "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
    "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kancheepuram",
    "Kanniyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
    "Nagapattinam", "Namakkal", "Perambalur", "Pudukkottai", "Ramanathapuram",
    "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "The Nilgiris",
    "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur",
    "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore",
    "Viluppuram", "Virudhunagar",
  ],
  Telangana: [
    "Adilabad", "Bhadradri Kothagudem", "Hanumakonda", "Hyderabad", "Jagtial",
    "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy",
    "Karimnagar", "Khammam", "Komaram Bheem Asifabad", "Mahabubabad",
    "Mahabubnagar", "Mancherial", "Medak", "Medchal-Malkajgiri", "Mulugu",
    "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli",
    "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet", "Suryapet",
    "Vikarabad", "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri",
  ],
  Tripura: [
    "Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala", "South Tripura",
    "Unakoti", "West Tripura",
  ],
  "Uttar Pradesh": [
    "Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya",
    "Azamgarh", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda",
    "Barabanki", "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun",
    "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah",
    "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad",
    "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras",
    "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar",
    "Kasganj", "Kaushambi", "Kheri", "Kushinagar", "Lalitpur", "Lucknow",
    "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur",
    "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Prayagraj",
    "Raebareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar",
    "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar", "Sitapur",
    "Sonbhadra", "Sultanpur", "Unnao", "Varanasi",
  ],
  Uttarakhand: [
    "Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar",
    "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag", "Tehri Garhwal",
    "Udham Singh Nagar", "Uttarkashi",
  ],
  "West Bengal": [
    "Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur",
    "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong",
    "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas",
    "Paschim Bardhaman", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur",
    "Purulia", "South 24 Parganas", "Uttar Dinajpur",
  ],

  // ── Union Territories ─────────────────────────────────────────────────────
  "Andaman and Nicobar Islands": [
    "Nicobar", "North and Middle Andaman", "South Andaman",
  ],
  Chandigarh: ["Chandigarh"],
  "Dadra and Nagar Haveli and Daman and Diu": [
    "Dadra and Nagar Haveli", "Daman", "Diu",
  ],
  "Jammu and Kashmir": [
    "Anantnag", "Bandipora", "Baramulla", "Budgam", "Doda", "Ganderbal", "Jammu",
    "Kathua", "Kishtwar", "Kulgam", "Kupwara", "Poonch", "Pulwama", "Rajouri",
    "Ramban", "Reasi", "Samba", "Shopian", "Srinagar", "Udhampur",
  ],
  // Five new districts notified 27 April 2026 took Ladakh from two to seven.
  Ladakh: ["Kargil", "Leh", "Drass", "Zanskar", "Sham", "Nubra", "Changthang"],
  Lakshadweep: ["Lakshadweep"],
  Delhi: [
    "Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi",
    "North West Delhi", "Shahdara", "South Delhi", "South East Delhi",
    "South West Delhi", "West Delhi", "Narela", "Rohini",
  ],
  Puducherry: ["Puducherry", "Karaikal"],
};
