import type { NewLongTripTemplate } from "./schema";

// Curated multi-day road-trip itineraries FROM Bangalore INTO five states —
// hand-authored, distinct from the computed multi-stop planner. Each day's
// stops are free text (not necessarily catalog place slugs) since these are
// fixed, pre-written plans.
type DayPlan = { day: number; items: string[] };
type SeedTrip = Omit<NewLongTripTemplate, "id" | "createdAt" | "itinerary"> & {
  itinerary: DayPlan[];
};

function days(...lines: string[]): DayPlan[] {
  const out: DayPlan[] = [];
  let current: DayPlan | null = null;
  for (const line of lines) {
    const m = line.match(/^Day (\d+)$/);
    if (m) {
      if (current) out.push(current);
      current = { day: Number(m[1]), items: [] };
    } else if (current) {
      current.items.push(line);
    }
  }
  if (current) out.push(current);
  return out;
}

const karnataka: SeedTrip[] = [
  {
    slug: "lt-karnataka-coorg-2d",
    state: "Karnataka",
    title: "2-Day Trip: Coorg (Kodagu)",
    days: 2,
    distanceKm: 265,
    destinationSummary: "Coorg",
    popularity: 92,
    itinerary: days(
      "Day 1", "Start from Bangalore (6 AM)", "Breakfast at Mysore Road", "Nisargadhama", "Dubare Elephant Camp", "Coffee plantation tour", "Check-in", "Raja's Seat Sunset",
      "Day 2", "Abbey Falls", "Madikeri Fort", "Omkareshwara Temple", "Shopping (Coffee, Chocolates, Spices)", "Return to Bangalore"
    ),
  },
  {
    slug: "lt-karnataka-wayanad-3d",
    state: "Karnataka",
    title: "3-Day Trip: Wayanad",
    days: 3,
    distanceKm: 280,
    destinationSummary: "Wayanad",
    popularity: 88,
    itinerary: days(
      "Day 1", "Bangalore → Wayanad", "Pookode Lake", "Tea Museum", "Stay",
      "Day 2", "Edakkal Caves", "Soochipara Falls", "Phantom Rock", "Local Market",
      "Day 3", "Banasura Sagar Dam", "Return"
    ),
  },
  {
    slug: "lt-karnataka-ooty-coonoor-4d",
    state: "Karnataka",
    title: "4-Day Trip: Ooty + Coonoor",
    days: 4,
    destinationSummary: "Ooty & Coonoor",
    popularity: 86,
    itinerary: days(
      "Day 1", "Bangalore → Ooty", "Botanical Garden", "Ooty Lake",
      "Day 2", "Doddabetta", "Tea Factory", "Rose Garden",
      "Day 3", "Toy Train to Coonoor", "Sim's Park", "Dolphin's Nose",
      "Day 4", "Pine Forest", "Pykara Lake", "Return"
    ),
  },
  {
    slug: "lt-karnataka-munnar-thekkady-5d",
    state: "Karnataka",
    title: "5-Day Trip: Munnar + Thekkady",
    days: 5,
    destinationSummary: "Munnar & Thekkady",
    popularity: 87,
    itinerary: days(
      "Day 1", "Bangalore → Munnar",
      "Day 2", "Tea Gardens", "Eravikulam Park", "Echo Point",
      "Day 3", "Mattupetty Dam", "Top Station", "Drive to Thekkady",
      "Day 4", "Periyar Boat Safari", "Spice Plantation", "Kathakali Show",
      "Day 5", "Return"
    ),
  },
  {
    slug: "lt-karnataka-goa-6d",
    state: "Karnataka",
    title: "6-Day Trip: Goa",
    days: 6,
    destinationSummary: "Goa",
    popularity: 90,
    itinerary: days(
      "Day 1", "Travel to Goa",
      "Day 2", "North Goa Beaches",
      "Day 3", "Fort Aguada", "Chapora Fort", "Water Sports",
      "Day 4", "South Goa",
      "Day 5", "Old Goa Churches", "Casino/Nightlife",
      "Day 6", "Return"
    ),
  },
  {
    slug: "lt-karnataka-kerala-highlights-7d",
    state: "Karnataka",
    title: "7-Day Trip: Kerala Highlights",
    days: 7,
    destinationSummary: "Kochi, Munnar, Thekkady & Alleppey",
    popularity: 85,
    itinerary: days(
      "Day 1", "Bangalore → Kochi",
      "Day 2", "Kochi sightseeing",
      "Day 3", "Munnar",
      "Day 4", "Munnar attractions",
      "Day 5", "Thekkady",
      "Day 6", "Alleppey Houseboat",
      "Day 7", "Return"
    ),
  },
  {
    slug: "lt-karnataka-grand-tour-8d",
    state: "Karnataka",
    title: "8-Day Trip: Karnataka Grand Tour",
    days: 8,
    destinationSummary: "Mysore, Coorg, Chikmagalur & Hampi",
    popularity: 91,
    itinerary: days(
      "Day 1", "Bangalore → Mysore",
      "Day 2", "Coorg",
      "Day 3", "Coorg",
      "Day 4", "Chikmagalur",
      "Day 5", "Mullayanagiri",
      "Day 6", "Hampi",
      "Day 7", "Hampi Exploration",
      "Day 8", "Return"
    ),
  },
  {
    slug: "lt-karnataka-tn-hill-circuit-9d",
    state: "Karnataka",
    title: "9-Day Trip: Tamil Nadu Hill Circuit",
    days: 9,
    destinationSummary: "Yercaud, Kodaikanal, Ooty & Mysore",
    popularity: 80,
    itinerary: days(
      "Day 1", "Yercaud",
      "Day 2", "Yercaud",
      "Day 3", "Kodaikanal",
      "Day 4", "Kodaikanal",
      "Day 5", "Ooty",
      "Day 6", "Ooty",
      "Day 7", "Coonoor",
      "Day 8", "Mysore",
      "Day 9", "Return"
    ),
  },
  {
    slug: "lt-karnataka-south-india-explorer-10d",
    state: "Karnataka",
    title: "10-Day Trip: South India Explorer",
    days: 10,
    destinationSummary: "Mysore, Coorg, Wayanad, Munnar, Thekkady & Kochi",
    popularity: 89,
    itinerary: days(
      "Day 1", "Bangalore → Mysore",
      "Day 2", "Mysore → Coorg",
      "Day 3", "Coorg",
      "Day 4", "Wayanad",
      "Day 5", "Wayanad",
      "Day 6", "Munnar",
      "Day 7", "Munnar",
      "Day 8", "Thekkady",
      "Day 9", "Kochi",
      "Day 10", "Return to Bangalore"
    ),
  },
  {
    slug: "lt-karnataka-premium-goa-10d",
    state: "Karnataka",
    title: "10-Day Premium Road Trip: Karnataka + Goa",
    days: 10,
    destinationSummary: "Chitradurga, Jog Falls, Murudeshwar, Gokarna & Goa",
    popularity: 84,
    itinerary: days(
      "Day 1", "Bangalore → Chitradurga",
      "Day 2", "Jog Falls",
      "Day 3", "Murudeshwar",
      "Day 4", "Gokarna",
      "Day 5", "Gokarna Beaches",
      "Day 6", "Goa North",
      "Day 7", "Goa South",
      "Day 8", "Dudhsagar Falls",
      "Day 9", "Belagavi",
      "Day 10", "Belagavi → Bangalore"
    ),
  },
];

const andhraPradesh: SeedTrip[] = [
  {
    slug: "lt-ap-horsley-hills-2d",
    state: "Andhra Pradesh",
    title: "2-Day Trip: Horsley Hills",
    days: 2,
    distanceKm: 155,
    destinationSummary: "Horsley Hills",
    popularity: 75,
    itinerary: days(
      "Day 1", "Bangalore → Horsley Hills", "Environmental Park", "Gali Bandalu View Point", "Mallamma Temple", "Sunset Point", "Overnight Stay",
      "Day 2", "Sunrise", "Nature Walk", "Horsley Hills Zoo", "Return to Bangalore"
    ),
  },
  {
    slug: "lt-ap-lepakshi-belum-3d",
    state: "Andhra Pradesh",
    title: "3-Day Trip: Lepakshi + Belum Caves",
    days: 3,
    distanceKm: 380,
    destinationSummary: "Lepakshi & Belum Caves",
    popularity: 74,
    itinerary: days(
      "Day 1", "Bangalore → Lepakshi", "Veerabhadra Temple", "Hanging Pillar", "Giant Nandi", "Stay at Anantapur",
      "Day 2", "Belum Caves", "Bugga Ramalingeswara Temple", "Stay",
      "Day 3", "Return to Bangalore"
    ),
  },
  {
    slug: "lt-ap-gandikota-4d",
    state: "Andhra Pradesh",
    title: "4-Day Trip: Gandikota",
    days: 4,
    destinationSummary: "Gandikota",
    popularity: 78,
    itinerary: days(
      "Day 1", "Bangalore → Gandikota", "Fort Visit",
      "Day 2", "Grand Canyon View", "Pennar River", "Camping",
      "Day 3", "Madhavaraya Temple", "Jamia Masjid", "Adventure Activities",
      "Day 4", "Return"
    ),
  },
  {
    slug: "lt-ap-tirupati-srikalahasti-5d",
    state: "Andhra Pradesh",
    title: "5-Day Trip: Tirupati + Srikalahasti",
    days: 5,
    destinationSummary: "Tirupati, Srikalahasti & Talakona",
    popularity: 88,
    itinerary: days(
      "Day 1", "Bangalore → Tirupati",
      "Day 2", "Tirumala Darshan", "Akasa Ganga", "Papavinasam",
      "Day 3", "Srikalahasti Temple", "Chandragiri Fort",
      "Day 4", "Talakona Waterfalls",
      "Day 5", "Return"
    ),
  },
  {
    slug: "lt-ap-araku-valley-6d",
    state: "Andhra Pradesh",
    title: "6-Day Trip: Araku Valley",
    days: 6,
    destinationSummary: "Araku Valley",
    popularity: 76,
    itinerary: days(
      "Day 1", "Bangalore → Visakhapatnam (Train/Flight)",
      "Day 2", "Scenic Train to Araku",
      "Day 3", "Borra Caves", "Coffee Museum",
      "Day 4", "Katiki Falls", "Tribal Museum",
      "Day 5", "Padmapuram Gardens",
      "Day 6", "Return"
    ),
  },
  {
    slug: "lt-ap-vizag-araku-7d",
    state: "Andhra Pradesh",
    title: "7-Day Trip: Vizag + Araku",
    days: 7,
    destinationSummary: "Visakhapatnam & Araku",
    popularity: 77,
    itinerary: days(
      "Day 1", "Bangalore → Vizag",
      "Day 2", "RK Beach", "Submarine Museum", "Kailasagiri",
      "Day 3", "Yarada Beach",
      "Day 4", "Train to Araku",
      "Day 5", "Borra Caves",
      "Day 6", "Tribal Museum", "Coffee Plantation",
      "Day 7", "Return"
    ),
  },
  {
    slug: "lt-ap-rayalaseema-heritage-8d",
    state: "Andhra Pradesh",
    title: "8-Day Trip: Rayalaseema Heritage Circuit",
    days: 8,
    destinationSummary: "Rayalaseema Heritage Circuit",
    popularity: 72,
    itinerary: days(
      "Day 1", "Bangalore → Lepakshi",
      "Day 2", "Belum Caves",
      "Day 3", "Gandikota",
      "Day 4", "Yaganti Temple",
      "Day 5", "Ahobilam",
      "Day 6", "Trek & Temples",
      "Day 7", "Mantralayam",
      "Day 8", "Return"
    ),
  },
  {
    slug: "lt-ap-coastal-explorer-9d",
    state: "Andhra Pradesh",
    title: "9-Day Trip: Coastal Andhra Explorer",
    days: 9,
    destinationSummary: "Coastal Andhra Explorer",
    popularity: 73,
    itinerary: days(
      "Day 1", "Bangalore → Vizag",
      "Day 2", "RK Beach", "Kailasagiri",
      "Day 3", "Rushikonda",
      "Day 4", "Bheemunipatnam",
      "Day 5", "Kakinada",
      "Day 6", "Coringa Wildlife Sanctuary",
      "Day 7", "Hope Island",
      "Day 8", "Local Sightseeing",
      "Day 9", "Return"
    ),
  },
  {
    slug: "lt-ap-complete-explorer-10d",
    state: "Andhra Pradesh",
    title: "10-Day Trip: Andhra Complete Explorer",
    days: 10,
    destinationSummary: "Rayalaseema Complete Explorer",
    popularity: 79,
    itinerary: days(
      "Day 1", "Bangalore → Lepakshi",
      "Day 2", "Belum Caves",
      "Day 3", "Gandikota",
      "Day 4", "Yaganti",
      "Day 5", "Ahobilam",
      "Day 6", "Tirupati",
      "Day 7", "Tirumala",
      "Day 8", "Srikalahasti",
      "Day 9", "Talakona Waterfalls",
      "Day 10", "Return"
    ),
  },
  {
    slug: "lt-ap-grand-tour-10d",
    state: "Andhra Pradesh",
    title: "10-Day Grand Andhra Tour",
    days: 10,
    destinationSummary: "Visakhapatnam, Araku & Lambasingi",
    popularity: 74,
    itinerary: days(
      "Day 1", "Bangalore → Visakhapatnam",
      "Day 2", "RK Beach", "Kailasagiri",
      "Day 3", "Araku Valley",
      "Day 4", "Borra Caves",
      "Day 5", "Katiki Falls",
      "Day 6", "Lambasingi",
      "Day 7", "Coffee Plantations",
      "Day 8", "Simhachalam Temple",
      "Day 9", "Yarada Beach",
      "Day 10", "Return to Bangalore"
    ),
  },
];

const tamilNadu: SeedTrip[] = [
  {
    slug: "lt-tn-yelagiri-2d",
    state: "Tamil Nadu",
    title: "2-Day Trip: Yelagiri",
    days: 2,
    distanceKm: 165,
    destinationSummary: "Yelagiri",
    popularity: 74,
    itinerary: days(
      "Day 1", "Bangalore → Yelagiri", "Punganoor Lake", "Nature Park", "Boating", "Sunset View", "Overnight Stay",
      "Day 2", "Swamimalai Trek", "Jalagamparai Falls", "Return to Bangalore"
    ),
  },
  {
    slug: "lt-tn-yercaud-3d",
    state: "Tamil Nadu",
    title: "3-Day Trip: Yercaud",
    days: 3,
    distanceKm: 230,
    destinationSummary: "Yercaud",
    popularity: 75,
    itinerary: days(
      "Day 1", "Bangalore → Yercaud", "Yercaud Lake", "Anna Park",
      "Day 2", "Lady's Seat", "Pagoda Point", "Botanical Garden", "Kiliyur Falls",
      "Day 3", "Bear's Cave", "Return to Bangalore"
    ),
  },
  {
    slug: "lt-tn-ooty-coonoor-4d",
    state: "Tamil Nadu",
    title: "4-Day Trip: Ooty & Coonoor",
    days: 4,
    destinationSummary: "Ooty & Coonoor",
    popularity: 86,
    itinerary: days(
      "Day 1", "Bangalore → Ooty", "Ooty Lake", "Botanical Garden",
      "Day 2", "Doddabetta Peak", "Tea Factory", "Rose Garden",
      "Day 3", "Toy Train to Coonoor", "Sim's Park", "Dolphin's Nose",
      "Day 4", "Pine Forest", "Pykara Lake", "Return"
    ),
  },
  {
    slug: "lt-tn-kodaikanal-5d",
    state: "Tamil Nadu",
    title: "5-Day Trip: Kodaikanal",
    days: 5,
    destinationSummary: "Kodaikanal",
    popularity: 82,
    itinerary: days(
      "Day 1", "Bangalore → Kodaikanal",
      "Day 2", "Coaker's Walk", "Bryant Park", "Kodai Lake",
      "Day 3", "Pillar Rocks", "Pine Forest", "Guna Caves",
      "Day 4", "Mannavanur Lake", "Poombarai Village",
      "Day 5", "Silver Cascade Falls", "Return"
    ),
  },
  {
    slug: "lt-tn-madurai-rameswaram-6d",
    state: "Tamil Nadu",
    title: "6-Day Trip: Madurai + Rameswaram",
    days: 6,
    destinationSummary: "Madurai & Rameswaram",
    popularity: 81,
    itinerary: days(
      "Day 1", "Bangalore → Madurai",
      "Day 2", "Meenakshi Temple", "Thirumalai Nayakkar Palace",
      "Day 3", "Drive to Rameswaram", "Pamban Bridge",
      "Day 4", "Ramanathaswamy Temple", "Dhanushkodi",
      "Day 5", "APJ Abdul Kalam Memorial", "Beaches",
      "Day 6", "Return"
    ),
  },
  {
    slug: "lt-tn-ooty-mudumalai-mysore-7d",
    state: "Tamil Nadu",
    title: "7-Day Trip: Ooty + Mudumalai + Mysore",
    days: 7,
    destinationSummary: "Ooty, Mudumalai & Mysore Circuit",
    popularity: 80,
    itinerary: days(
      "Day 1", "Bangalore → Ooty",
      "Day 2", "Ooty Sightseeing",
      "Day 3", "Coonoor",
      "Day 4", "Mudumalai Safari",
      "Day 5", "Bandipur Drive", "Mysore",
      "Day 6", "Mysore Palace", "Brindavan Gardens",
      "Day 7", "Return"
    ),
  },
  {
    slug: "lt-tn-heritage-circuit-8d",
    state: "Tamil Nadu",
    title: "8-Day Trip: Tamil Nadu Heritage Circuit",
    days: 8,
    destinationSummary: "Kanchipuram, Mahabalipuram, Pondicherry & Thanjavur",
    popularity: 78,
    itinerary: days(
      "Day 1", "Bangalore → Kanchipuram",
      "Day 2", "Mahabalipuram",
      "Day 3", "Pondicherry",
      "Day 4", "Auroville", "Beaches",
      "Day 5", "Chidambaram",
      "Day 6", "Gangaikonda Cholapuram",
      "Day 7", "Thanjavur",
      "Day 8", "Return"
    ),
  },
  {
    slug: "lt-tn-southern-explorer-9d",
    state: "Tamil Nadu",
    title: "9-Day Trip: Southern Tamil Nadu Explorer",
    days: 9,
    destinationSummary: "Kodaikanal, Madurai, Rameswaram & Kanyakumari",
    popularity: 79,
    itinerary: days(
      "Day 1", "Bangalore → Kodaikanal",
      "Day 2", "Kodaikanal",
      "Day 3", "Madurai",
      "Day 4", "Madurai Sightseeing",
      "Day 5", "Rameswaram",
      "Day 6", "Dhanushkodi",
      "Day 7", "Kanyakumari",
      "Day 8", "Sunrise", "Vivekananda Rock", "Thiruvalluvar Statue",
      "Day 9", "Return"
    ),
  },
  {
    slug: "lt-tn-complete-tour-10d",
    state: "Tamil Nadu",
    title: "10-Day Trip: Complete Tamil Nadu Tour",
    days: 10,
    destinationSummary: "Ooty, Kodaikanal, Madurai, Rameswaram & Kanyakumari",
    popularity: 83,
    itinerary: days(
      "Day 1", "Bangalore → Ooty",
      "Day 2", "Ooty",
      "Day 3", "Coonoor",
      "Day 4", "Kodaikanal",
      "Day 5", "Kodaikanal",
      "Day 6", "Madurai",
      "Day 7", "Rameswaram",
      "Day 8", "Dhanushkodi",
      "Day 9", "Kanyakumari",
      "Day 10", "Return to Bangalore"
    ),
  },
  {
    slug: "lt-tn-grand-explorer-10d",
    state: "Tamil Nadu",
    title: "10-Day Grand Tamil Nadu Explorer",
    days: 10,
    destinationSummary: "Yercaud, Ooty, Kodaikanal, Madurai, Rameswaram, Kanyakumari & Pondicherry",
    popularity: 77,
    itinerary: days(
      "Day 1", "Bangalore → Yercaud",
      "Day 2", "Ooty",
      "Day 3", "Coonoor",
      "Day 4", "Kodaikanal",
      "Day 5", "Madurai",
      "Day 6", "Rameswaram",
      "Day 7", "Kanyakumari",
      "Day 8", "Tirunelveli",
      "Day 9", "Pondicherry",
      "Day 10", "Bangalore"
    ),
  },
];

const kerala: SeedTrip[] = [
  {
    slug: "lt-kerala-wayanad-2d",
    state: "Kerala",
    title: "2-Day Trip: Wayanad",
    days: 2,
    distanceKm: 280,
    destinationSummary: "Wayanad",
    popularity: 87,
    itinerary: days(
      "Day 1", "Bangalore → Wayanad", "Pookode Lake", "Tea Museum", "Overnight Stay",
      "Day 2", "Edakkal Caves", "Soochipara Falls", "Return to Bangalore"
    ),
  },
  {
    slug: "lt-kerala-wayanad-kozhikode-3d",
    state: "Kerala",
    title: "3-Day Trip: Wayanad + Kozhikode",
    days: 3,
    destinationSummary: "Wayanad & Kozhikode",
    popularity: 78,
    itinerary: days(
      "Day 1", "Bangalore → Wayanad", "Pookode Lake", "Stay",
      "Day 2", "Edakkal Caves", "Soochipara Falls", "Drive to Kozhikode", "Kappad Beach",
      "Day 3", "SM Street", "Return to Bangalore"
    ),
  },
  {
    slug: "lt-kerala-munnar-4d",
    state: "Kerala",
    title: "4-Day Trip: Munnar",
    days: 4,
    destinationSummary: "Munnar",
    popularity: 90,
    itinerary: days(
      "Day 1", "Bangalore → Munnar",
      "Day 2", "Eravikulam National Park", "Tea Museum", "Rose Garden",
      "Day 3", "Mattupetty Dam", "Echo Point", "Top Station",
      "Day 4", "Return to Bangalore"
    ),
  },
  {
    slug: "lt-kerala-munnar-thekkady-5d",
    state: "Kerala",
    title: "5-Day Trip: Munnar + Thekkady",
    days: 5,
    destinationSummary: "Munnar & Thekkady",
    popularity: 88,
    itinerary: days(
      "Day 1", "Bangalore → Munnar",
      "Day 2", "Munnar Sightseeing",
      "Day 3", "Drive to Thekkady", "Spice Plantation",
      "Day 4", "Periyar Boat Safari", "Kathakali Show",
      "Day 5", "Return"
    ),
  },
  {
    slug: "lt-kerala-kochi-munnar-thekkady-6d",
    state: "Kerala",
    title: "6-Day Trip: Kochi + Munnar + Thekkady",
    days: 6,
    destinationSummary: "Kochi, Munnar & Thekkady",
    popularity: 84,
    itinerary: days(
      "Day 1", "Bangalore → Kochi",
      "Day 2", "Fort Kochi", "Mattancherry Palace", "Marine Drive",
      "Day 3", "Drive to Munnar",
      "Day 4", "Munnar Sightseeing",
      "Day 5", "Thekkady",
      "Day 6", "Return"
    ),
  },
  {
    slug: "lt-kerala-munnar-thekkady-alleppey-7d",
    state: "Kerala",
    title: "7-Day Trip: Munnar + Thekkady + Alleppey",
    days: 7,
    destinationSummary: "Munnar, Thekkady & Alleppey",
    popularity: 89,
    itinerary: days(
      "Day 1", "Bangalore → Munnar",
      "Day 2", "Munnar Attractions",
      "Day 3", "Munnar Exploration",
      "Day 4", "Thekkady",
      "Day 5", "Periyar Safari",
      "Day 6", "Alleppey Houseboat Stay",
      "Day 7", "Return"
    ),
  },
  {
    slug: "lt-kerala-highlights-8d",
    state: "Kerala",
    title: "8-Day Trip: Kerala Highlights",
    days: 8,
    destinationSummary: "Kochi, Athirappilly, Munnar, Thekkady, Alleppey & Kumarakom",
    popularity: 86,
    itinerary: days(
      "Day 1", "Bangalore → Kochi",
      "Day 2", "Athirappilly Waterfalls",
      "Day 3", "Munnar",
      "Day 4", "Munnar",
      "Day 5", "Thekkady",
      "Day 6", "Alleppey",
      "Day 7", "Kumarakom",
      "Day 8", "Return"
    ),
  },
  {
    slug: "lt-kerala-beaches-hills-9d",
    state: "Kerala",
    title: "9-Day Trip: Kerala Beaches & Hills",
    days: 9,
    destinationSummary: "Munnar, Thekkady, Alleppey, Varkala & Kovalam",
    popularity: 83,
    itinerary: days(
      "Day 1", "Bangalore → Kochi",
      "Day 2", "Munnar",
      "Day 3", "Munnar",
      "Day 4", "Thekkady",
      "Day 5", "Alleppey",
      "Day 6", "Varkala",
      "Day 7", "Kovalam",
      "Day 8", "Trivandrum Sightseeing",
      "Day 9", "Return"
    ),
  },
  {
    slug: "lt-kerala-complete-explorer-10d",
    state: "Kerala",
    title: "10-Day Trip: Complete Kerala Explorer",
    days: 10,
    destinationSummary: "Wayanad, Kochi, Munnar, Thekkady, Alleppey, Varkala & Trivandrum",
    popularity: 85,
    itinerary: days(
      "Day 1", "Bangalore → Wayanad",
      "Day 2", "Wayanad",
      "Day 3", "Kochi",
      "Day 4", "Munnar",
      "Day 5", "Munnar",
      "Day 6", "Thekkady",
      "Day 7", "Alleppey",
      "Day 8", "Varkala",
      "Day 9", "Trivandrum",
      "Day 10", "Return"
    ),
  },
  {
    slug: "lt-kerala-grand-circuit-10d",
    state: "Kerala",
    title: "10-Day Grand Kerala Circuit",
    days: 10,
    destinationSummary: "Bekal, Wayanad, Kochi, Munnar, Thekkady, Kumarakom & Alleppey",
    popularity: 82,
    itinerary: days(
      "Day 1", "Bangalore → Bekal",
      "Day 2", "Bekal Fort", "Beach",
      "Day 3", "Wayanad",
      "Day 4", "Wayanad",
      "Day 5", "Kochi",
      "Day 6", "Munnar",
      "Day 7", "Thekkady",
      "Day 8", "Kumarakom",
      "Day 9", "Alleppey Houseboat",
      "Day 10", "Return to Bangalore"
    ),
  },
];

const maharashtra: SeedTrip[] = [
  {
    slug: "lt-mh-kolhapur-2d",
    state: "Maharashtra",
    title: "2-Day Trip: Kolhapur",
    days: 2,
    distanceKm: 610,
    destinationSummary: "Kolhapur",
    popularity: 68,
    itinerary: days(
      "Day 1", "Bangalore → Kolhapur", "Mahalaxmi Temple", "Rankala Lake", "Local Food Tour", "Overnight Stay",
      "Day 2", "Panhala Fort", "New Palace Museum", "Return to Bangalore"
    ),
  },
  {
    slug: "lt-mh-kolhapur-amboli-3d",
    state: "Maharashtra",
    title: "3-Day Trip: Kolhapur + Amboli",
    days: 3,
    destinationSummary: "Kolhapur & Amboli",
    popularity: 66,
    itinerary: days(
      "Day 1", "Bangalore → Kolhapur", "Temple Visit", "Stay",
      "Day 2", "Drive to Amboli", "Sunset Point", "Waterfalls",
      "Day 3", "Hiranyakeshi Temple", "Return"
    ),
  },
  {
    slug: "lt-mh-mahabaleshwar-4d",
    state: "Maharashtra",
    title: "4-Day Trip: Mahabaleshwar",
    days: 4,
    destinationSummary: "Mahabaleshwar",
    popularity: 79,
    itinerary: days(
      "Day 1", "Bangalore → Mahabaleshwar",
      "Day 2", "Venna Lake", "Arthur's Seat", "Elephant's Head Point",
      "Day 3", "Mapro Garden", "Pratapgad Fort",
      "Day 4", "Return"
    ),
  },
  {
    slug: "lt-mh-pune-lonavala-5d",
    state: "Maharashtra",
    title: "5-Day Trip: Pune + Lonavala",
    days: 5,
    destinationSummary: "Pune & Lonavala",
    popularity: 76,
    itinerary: days(
      "Day 1", "Bangalore → Pune",
      "Day 2", "Shaniwar Wada", "Aga Khan Palace", "Dagdusheth Temple",
      "Day 3", "Lonavala", "Bhushi Dam", "Tiger Point",
      "Day 4", "Karla Caves", "Lohagad Fort",
      "Day 5", "Return"
    ),
  },
  {
    slug: "lt-mh-mumbai-6d",
    state: "Maharashtra",
    title: "6-Day Trip: Mumbai",
    days: 6,
    destinationSummary: "Mumbai",
    popularity: 85,
    itinerary: days(
      "Day 1", "Bangalore → Mumbai",
      "Day 2", "Gateway of India", "Colaba", "Marine Drive",
      "Day 3", "Elephanta Caves", "CST Heritage Area",
      "Day 4", "Juhu Beach", "Bandra Fort", "Bandra-Worli Sea Link",
      "Day 5", "Siddhivinayak Temple", "Shopping",
      "Day 6", "Return"
    ),
  },
  {
    slug: "lt-mh-pune-lonavala-mumbai-7d",
    state: "Maharashtra",
    title: "7-Day Trip: Pune + Lonavala + Mumbai",
    days: 7,
    destinationSummary: "Pune, Lonavala & Mumbai",
    popularity: 78,
    itinerary: days(
      "Day 1", "Bangalore → Pune",
      "Day 2", "Pune Sightseeing",
      "Day 3", "Sinhagad Fort", "Lonavala",
      "Day 4", "Lonavala Attractions",
      "Day 5", "Mumbai",
      "Day 6", "Mumbai Sightseeing",
      "Day 7", "Return"
    ),
  },
  {
    slug: "lt-mh-heritage-circuit-8d",
    state: "Maharashtra",
    title: "8-Day Trip: Maharashtra Heritage Circuit",
    days: 8,
    destinationSummary: "Ajanta, Ellora & Chhatrapati Sambhajinagar Heritage Circuit",
    popularity: 81,
    itinerary: days(
      "Day 1", "Bangalore → Aurangabad (Chhatrapati Sambhajinagar)",
      "Day 2", "Ajanta Caves",
      "Day 3", "Ellora Caves",
      "Day 4", "Daulatabad Fort", "Bibi Ka Maqbara",
      "Day 5", "Grishneshwar Temple",
      "Day 6", "Paithan",
      "Day 7", "Local Exploration",
      "Day 8", "Return"
    ),
  },
  {
    slug: "lt-mh-nashik-pune-mumbai-9d",
    state: "Maharashtra",
    title: "9-Day Trip: Nashik + Pune + Mumbai",
    days: 9,
    destinationSummary: "Pune, Nashik & Mumbai",
    popularity: 74,
    itinerary: days(
      "Day 1", "Bangalore → Pune",
      "Day 2", "Pune",
      "Day 3", "Nashik",
      "Day 4", "Sula Vineyards", "Trimbakeshwar",
      "Day 5", "Mumbai",
      "Day 6", "South Mumbai",
      "Day 7", "Elephanta",
      "Day 8", "Bandra & Juhu",
      "Day 9", "Return"
    ),
  },
  {
    slug: "lt-mh-complete-explorer-10d",
    state: "Maharashtra",
    title: "10-Day Trip: Complete Maharashtra Explorer",
    days: 10,
    destinationSummary: "Mahabaleshwar, Ajanta, Ellora, Mumbai & Lonavala",
    popularity: 80,
    itinerary: days(
      "Day 1", "Bangalore → Pune",
      "Day 2", "Mahabaleshwar",
      "Day 3", "Mahabaleshwar",
      "Day 4", "Aurangabad (Chhatrapati Sambhajinagar)",
      "Day 5", "Ajanta",
      "Day 6", "Ellora",
      "Day 7", "Mumbai",
      "Day 8", "Mumbai",
      "Day 9", "Lonavala",
      "Day 10", "Return"
    ),
  },
  {
    slug: "lt-mh-grand-road-trip-10d",
    state: "Maharashtra",
    title: "10-Day Grand Maharashtra Road Trip",
    days: 10,
    destinationSummary: "Kolhapur, Ganpatipule, Ratnagiri, Tarkarli & Amboli",
    popularity: 71,
    itinerary: days(
      "Day 1", "Bangalore → Kolhapur",
      "Day 2", "Panhala Fort", "Kolhapur City",
      "Day 3", "Ganpatipule",
      "Day 4", "Ratnagiri",
      "Day 5", "Ganeshgule Beach", "Ratnadurg Fort",
      "Day 6", "Tarkarli",
      "Day 7", "Scuba Diving", "Sindhudurg Fort",
      "Day 8", "Malvan",
      "Day 9", "Amboli Ghat",
      "Day 10", "Return to Bangalore"
    ),
  },
];

const ALL_TRIPS: SeedTrip[] = [...karnataka, ...andhraPradesh, ...tamilNadu, ...kerala, ...maharashtra];

export const longTripSeeds: NewLongTripTemplate[] = ALL_TRIPS.map((t) => ({
  ...t,
  itinerary: JSON.stringify(t.itinerary),
}));
