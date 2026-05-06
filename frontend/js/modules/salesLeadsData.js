/**
 * Default seed data for Sales → Leads when using offline/demo login (localStorage).
 * With a real session, leads are loaded from GET /api/leads (SQLite `sales_leads`).
 */

export const SALES_PROSPECTS = [
    {
        id: 1,
        name: 'Matternet',
        segment: 'Drone manufacturers',
        location: '355 Ravendale Drive, Mountain View, CA 94043',
        phone: '+1-650-260-2727',
        email: 'contact@matternet.us',
        industry: 'Aerial delivery systems for healthcare, e-commerce, logistics',
        notes: '',
        priorityTarget: true
    },
    {
        id: 2,
        name: 'AeroVironment',
        segment: 'Drone manufacturers',
        location: '900 Innovators Way, Simi Valley, CA 93065-0906',
        phone: '805-520-8350 or 626-357-9983',
        email: 'newsupplier@avinc.com',
        industry: 'Small UAS, defense and commercial applications',
        notes: 'Supplier contact: newsupplier@avinc.com. Engineering changes: SupplierChangeRequests@avinc.com'
    },
    {
        id: 3,
        name: 'Inspired Flight Technologies',
        segment: 'Drone manufacturers',
        location: 'U.S.-based (Blue UAS certified)',
        industry: 'American-made drones with U.S. components',
        notes: ''
    },
    {
        id: 4,
        name: 'Aero Systems West',
        segment: 'Drone manufacturers',
        location: 'San Martin, CA',
        industry: 'Heavy lift multirotor systems',
        notes: ''
    },
    {
        id: 5,
        name: 'Action Drone Inc.',
        segment: 'Drone manufacturers',
        location: 'San Diego, CA',
        industry: 'Industrial drones for government and commercial',
        notes: ''
    },
    {
        id: 6,
        name: 'Hitec Commercial Solutions',
        segment: 'Drone manufacturers',
        location: 'San Diego, CA',
        industry: 'Specialized unmanned vehicles',
        notes: ''
    },
    {
        id: 7,
        name: 'UVify',
        segment: 'Drone manufacturers',
        location: '',
        industry: 'Industrial performance and racing drones',
        notes: ''
    },
    {
        id: 8,
        name: 'Inova Drone',
        segment: 'Drone manufacturers',
        location: '',
        industry: 'Multi-mission UAS for government, defense, commercial markets',
        notes: ''
    },
    {
        id: 9,
        name: 'Bear Robotics',
        segment: 'Consumer & industrial robotics',
        location: '785 Broadway Street, Redwood City, CA 94063',
        phone: '(650) 260-2931 or 1-844-729-2327',
        email: 'john@bearrobotics.ai',
        industry: 'Autonomous mobile robots for food service/hospitality',
        notes: 'CEO: john@bearrobotics.ai. Contact: lindsey@bearrobotics.ai',
        priorityTarget: true
    },
    {
        id: 10,
        name: 'Trifo',
        segment: 'Consumer & industrial robotics',
        location: 'Bay Area, CA',
        industry: 'AI-based vacuum cleaning robots',
        notes: ''
    },
    {
        id: 11,
        name: 'Relay Robotics',
        segment: 'Consumer & industrial robotics',
        location: 'Menlo Park, CA',
        industry: 'Autonomous service robots for hospitality/healthcare',
        notes: ''
    },
    {
        id: 12,
        name: 'Watney Robotics',
        segment: 'Consumer & industrial robotics',
        location: 'California',
        industry: 'Household automation (laundry folding)',
        notes: ''
    },
    {
        id: 13,
        name: 'InGen Dynamics',
        segment: 'Consumer & industrial robotics',
        location: 'California',
        industry: 'Interactive personal home robots',
        notes: ''
    },
    {
        id: 14,
        name: 'Ekso Bionics',
        segment: 'Consumer & industrial robotics',
        location: 'California',
        industry: 'Exoskeletons for rehabilitation',
        notes: ''
    },
    {
        id: 15,
        name: 'GrayMatter Robotics',
        segment: 'Consumer & industrial robotics',
        location: 'Los Angeles, CA',
        industry: 'AI robotics for factory automation',
        notes: ''
    },
    {
        id: 16,
        name: 'Futronics (NA) Corporation',
        segment: 'Consumer & industrial robotics',
        location: 'Los Angeles, CA',
        industry: 'Healthcare service robots',
        notes: ''
    },
    {
        id: 17,
        name: 'Blue Robotics',
        segment: 'Consumer & industrial robotics',
        location: 'Torrance, CA',
        industry: 'Marine robotics components',
        notes: ''
    },
    {
        id: 18,
        name: 'Honeybee Robotics',
        segment: 'Consumer & industrial robotics',
        location: 'California',
        industry: 'Space exploration robotics',
        notes: ''
    },
    {
        id: 19,
        name: 'Intuitive Surgical',
        segment: 'Medical device manufacturers',
        location: '1020 Kifer Road, Sunnyvale, CA 94086-5304',
        phone: '+1-408-523-2100',
        industry: 'da Vinci surgical system',
        notes: 'Fax: +1-408-523-1390. Procurement software: Coupa, Ariba, SAP, Oracle',
        priorityTarget: true
    },
    {
        id: 20,
        name: 'Align Technology',
        segment: 'Medical device manufacturers',
        location: 'San Jose, CA',
        industry: 'Invisalign system',
        notes: ''
    },
    {
        id: 21,
        name: 'The Cooper Companies',
        segment: 'Medical device manufacturers',
        location: 'San Ramon, CA',
        industry: 'Medical devices',
        notes: ''
    },
    {
        id: 22,
        name: 'Abbott Laboratories',
        segment: 'Medical device manufacturers',
        location: 'California (medical device division)',
        industry: 'Medical technology',
        notes: ''
    },
    {
        id: 23,
        name: 'Becton Dickinson',
        segment: 'Medical device manufacturers',
        location: 'California',
        industry: 'Medical technology',
        notes: ''
    },
    {
        id: 24,
        name: 'Edwards Lifesciences',
        segment: 'Medical device manufacturers',
        location: 'California',
        industry: 'Cardiovascular devices',
        notes: ''
    },
    {
        id: 25,
        name: 'Philips Medical Systems Inc',
        segment: 'Medical device manufacturers',
        location: 'Northern California',
        industry: 'Medical imaging and devices',
        notes: ''
    },
    {
        id: 26,
        name: 'Acclarent, Inc.',
        segment: 'Medical device manufacturers',
        location: 'Northern California',
        industry: 'Medical devices',
        notes: ''
    },
    {
        id: 27,
        name: 'Stellartech Research Corporation',
        segment: 'Medical device manufacturers',
        location: 'Northern California',
        industry: 'Medical devices',
        notes: ''
    },
    {
        id: 28,
        name: 'Precision Aerospace Corporation',
        segment: 'Aerospace companies',
        location: 'Rancho Cucamonga, CA',
        industry: 'Aerospace machining and fabrication',
        notes: 'Certifications: AS9100, ISO9001, NADCAP'
    },
    {
        id: 29,
        name: 'California Machine Specialties',
        segment: 'Aerospace companies',
        location: 'Southern California',
        industry: 'Aerospace machining',
        notes: 'Certifications: AS 9100, ISO 9001, ITAR registered. Customers: SpaceX, Raytheon, L3Harris Technologies'
    },
    {
        id: 30,
        name: 'SR Machining',
        segment: 'Aerospace companies',
        location: 'Southern California',
        industry: 'Aircraft components',
        notes: 'Certifications: ISO 9001, AS9100'
    },
    {
        id: 31,
        name: 'Samarth Precision',
        segment: 'Aerospace companies',
        location: 'California',
        industry: 'Aerospace machining',
        notes: ''
    },
    {
        id: 32,
        name: 'EDRO US',
        segment: 'Aerospace companies',
        location: 'Walnut, CA',
        industry: 'Large precision aerospace components',
        notes: 'Certifications: ISO9001/AS9100D'
    },
    {
        id: 33,
        name: 'Mendocino Wine Company',
        segment: 'Wine bottling (Ukiah area)',
        location: '501 Parducci Rd., Ukiah, CA 95482',
        phone: '(800) 362-9463 / 707-228-4013 / 707-463-5380',
        email: 'production@mendocinowineco.com',
        industry: 'Custom crush, processing, bottling',
        notes: 'Production team: production@mendocinowineco.com, 707-463-5377. Services: Tyler Rodrigue tylerr@mendocinowineco.com, 415-533-8642. Operations: Valerie Machen valeriem@mendocinowineco.com, 707-272-4655',
        priorityTarget: true
    },
    {
        id: 34,
        name: 'RIVINO Winery',
        segment: 'Wine bottling (Ukiah area)',
        location: '4001 Rivino Ranch Rd, Ukiah, CA 95482',
        phone: '(707) 472-6934',
        email: 'suzanne@rivinowinery.com',
        industry: 'Boutique winery with on-site bottling',
        notes: 'Contact: Suzanne Jahnke'
    },
    {
        id: 35,
        name: 'Ukiah Wine Cache',
        segment: 'Wine bottling (Ukiah area)',
        location: 'Ukiah, CA',
        industry: 'Bulk wine storage',
        notes: 'Service area: Mendocino, Lake, and Sonoma Counties'
    },
    {
        id: 36,
        name: 'Maverick Enterprises',
        segment: 'Wine bottling (Ukiah area)',
        location: 'Ukiah, CA',
        industry: 'Wine bottle capsules and champagne foil capsules',
        notes: ''
    },
    {
        id: 37,
        name: 'Redwood Valley Cellars',
        segment: 'Wine bottling (Ukiah area)',
        location: 'Redwood Valley (near Ukiah)',
        industry: 'Custom crushing/storage facility',
        notes: '20+ years experience'
    },
    {
        id: 38,
        name: 'Pedroncelli Mobile Bottling',
        segment: 'Mobile bottling (Northern CA)',
        location: '18775 Carriger Rd, Sonoma, CA 95476',
        phone: '707-252-8177',
        email: 'pedroncellimb@gmail.com',
        industry: 'Mobile bottling',
        notes: 'Contact: Krista Jensen. 20+ years experience',
        priorityTarget: true
    },
    {
        id: 39,
        name: 'Bottle Works Mobile Bottling',
        segment: 'Mobile bottling (Northern CA)',
        location: '',
        phone: '(707) 852-5146',
        email: 'info@bottleworksmobilebottling.com',
        industry: 'Mobile bottling',
        notes: 'Service area: Northern California Wine Country'
    },
    {
        id: 40,
        name: 'Halsey Bottling',
        segment: 'Mobile bottling (Northern CA)',
        location: '2471 Solano Ave., #133, Napa, CA 94558',
        email: 'info@halseybottling.com',
        industry: 'Mobile bottling',
        notes: 'Erin Halsey: 707-294-8898, info@halseybottling.com. Lori: (707) 256-9604, lori@halseybottling.com. Dan: (707) 695-1149, dan@halseybottling.com. Capacity: 2,500-4,000 cases/day'
    },
    {
        id: 41,
        name: 'Castoro Bottling Company',
        segment: 'Mobile bottling (Northern CA)',
        location: 'Paso Robles, CA',
        phone: '(805) 467-2002',
        industry: 'Mobile bottling',
        notes: 'Founded 1989. 5 mobile bottling lines. Capacity: 1,500-2,500 cases/day'
    },
    {
        id: 42,
        name: 'Select Mobile Bottlers',
        segment: 'Mobile bottling (Northern CA)',
        location: 'Napa Valley',
        phone: '707-252-8177',
        email: 'office@selectmobilebottlers.com',
        industry: 'Full-service mobile bottling',
        notes: ''
    },
    {
        id: 43,
        name: 'The Bottle Meister',
        segment: 'Mobile bottling (Northern CA)',
        location: 'Central Coast, CA',
        industry: 'Mobile bottling',
        notes: 'Service area: Napa, Sonoma to Temecula. California\'s only certified organic bottler'
    },
    {
        id: 44,
        name: 'Peregrine Mobile Bottling',
        segment: 'Mobile bottling (Northern CA)',
        location: '',
        industry: 'Mobile bottling, crossflow filtration, wine gas management',
        notes: 'Service area: Napa, Sonoma, Mendocino, San Joaquin counties'
    },
    {
        id: 45,
        name: 'Sonoma Bespoke / Steelbird Custom Wine Production',
        segment: 'Wine equipment & services',
        location: 'Napa, CA',
        industry: 'Custom bottling, 3L bag-in-box production',
        notes: 'Capacity: 12,500 750ml cases/day; 2+ million cases annually'
    },
    {
        id: 46,
        name: 'Carlsen & Associates',
        segment: 'Wine equipment & services',
        location: 'Northern California',
        industry: 'Pumps, hoppers, conveyors, crushers, presses',
        notes: '35+ years in business'
    },
    {
        id: 47,
        name: 'TCW Equipment',
        segment: 'Wine equipment & services',
        location: 'California',
        industry: 'Bottling equipment, presses, pumps, stainless tanks',
        notes: ''
    },
    {
        id: 48,
        name: 'Napa Wine Company',
        segment: 'Wine equipment & services',
        location: 'Napa, CA',
        industry: 'Grape to bottle services',
        notes: ''
    }
];
