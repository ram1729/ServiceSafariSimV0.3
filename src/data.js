// ═══════════════════════════════════════════════════
// VENUE DATA — carried over verbatim from v0.1.
// v0.3 layout fixes (overlapping footprints can't be walls in 3D):
//   airport.dutyfree w .25→.20 · hotel.bar h .25→.20 · university.lab h .30→.20
//   bank.entrance w .30→.25 · sportsArena concourse moved to its own band (y .50–.65),
//   concessions / restrooms / merch moved below it (y .65–.80)
// ═══════════════════════════════════════════════════
export const VENUES = {
museum:{name:'Museum',zones:[
['entrance','Entrance',0,0.78,0.25,0.22,'#d4c5a9'],
['info','Info Desk',0.25,0.78,0.25,0.22,'#c9b896'],
['galleryA','Gallery A',0,0,0.5,0.40,'#8a8278'],
['galleryB','Gallery B',0,0.40,0.5,0.38,'#b8a09a'],
['sculpture','Sculpture',0.5,0,0.25,0.50,'#7a8a8f'],
['cafe','Cafe',0.75,0,0.25,0.40,'#8a9a7a'],
['giftshop','Gift Shop',0.5,0.50,0.25,0.28,'#c4b08a'],
['exhibit','Special Exhibit',0.75,0.40,0.25,0.60,'#9a7a8a']],
archetypes:[['Art Enthusiast',8,5,0.7],['Tourist',5,6,1.2],['Student',6,8,1.0],['Family Visitor',4,4,0.8],['Researcher',9,7,0.5]],
dialogues:{enter:['{name} checks the floor map.','{name} gazes at the grand entrance.'],explore:['{name} admires the paintings in {zone}.','{name} reads a plaque carefully.'],queue:['{name}: This ticket line is absurd.','{name} waits, tapping foot.'],frustrated:['{name}: Can\'t see through this crowd!','{name}: Where are the labels?'],satisfied:['{name}: What a wonderful exhibition!','{name}: This sculpture is breathtaking.'],exit:['{name} heads to the exit, smiling.','{name} picks up a brochure on the way out.']},
needs:['wants to see the Impressionists','looking for the gift shop','needs the restroom','wants a quiet gallery','hunting for the special exhibit']},

hospital:{name:'Hospital',zones:[
['reception','Reception',0,0,0.35,0.25,'#b8c4ca'],
['waiting','Waiting Room',0,0.25,0.35,0.35,'#a0b8c8'],
['emergency','Emergency',0.35,0,0.35,0.30,'#c49a9a'],
['wardA','Ward A',0,0.60,0.5,0.40,'#9ab0c0'],
['wardB','Ward B',0.5,0.60,0.5,0.40,'#9abaa8'],
['pharmacy','Pharmacy',0.70,0,0.30,0.30,'#8a9aaa'],
['cafeteria','Cafeteria',0.35,0.30,0.35,0.30,'#c0b0a0'],
['radiology','Radiology',0.70,0.30,0.30,0.30,'#a0a0c0']],
archetypes:[['Patient',4,5,0.6],['Visitor',5,6,1.0],['Anxious Relative',3,4,1.3],['Elderly Patient',6,3,0.4],['Parent w/ Child',4,5,0.8]],
dialogues:{enter:['{name} approaches reception nervously.','{name} checks the appointment board.'],explore:['{name} follows signs to {zone}.','{name} looks for directions.'],queue:['{name}: I\'ve been waiting an hour!','{name} shifts in the plastic chair.'],frustrated:['{name}: Nobody will tell me anything!','{name}: This place is a maze.'],satisfied:['{name}: The nurse was so kind.','{name}: Finally, some answers.'],exit:['{name} leaves with a prescription.','{name} walks out, relieved.']},
needs:['worried about test results','trying to find Ward B','needs wheelchair access','wants to see a specialist','looking for the pharmacy']},

airport:{name:'Airport',zones:[
['checkin','Check-In',0,0,0.30,0.30,'#a0a0a0'],
['security','Security',0.30,0,0.30,0.30,'#b09080'],
['lounge','Dep. Lounge',0,0.30,0.40,0.35,'#8a9098'],
['gates','Gate Area',0.60,0,0.40,0.50,'#7890a0'],
['baggage','Baggage Claim',0,0.65,0.35,0.35,'#b0b8c0'],
['arrivals','Arrivals',0.35,0.65,0.30,0.35,'#8088a0'],
['dutyfree','Duty Free',0.40,0.30,0.20,0.35,'#c0a0a0'],
['foodcourt','Food Court',0.65,0.50,0.35,0.50,'#b8a888']],
archetypes:[['Business Traveler',3,9,1.5],['Family Traveler',5,5,0.7],['First-Timer',7,4,0.8],['Frequent Flyer',6,9,1.3],['Anxious Flyer',2,5,1.1]],
dialogues:{enter:['{name} checks the departure board.','{name} drags luggage through the entrance.'],explore:['{name} searches for gate in {zone}.','{name} scans the monitors.'],queue:['{name}: This security line is insane.','{name} shuffles forward in line.'],frustrated:['{name}: If I miss my flight!','{name}: Nobody speaks my language here.'],satisfied:['{name}: Lounge access, finally.','{name}: Boarding on time, nice.'],exit:['{name} boards the aircraft.','{name} exits through arrivals.']},
needs:['needs to find the right gate','looking for a power outlet','wants lounge access','has a tight connection','needs to find lost luggage']},

retail:{name:'Retail Store',zones:[
['entrance','Entrance',0,0.80,0.30,0.20,'#c8b898'],
['clothing','Clothing',0,0,0.40,0.40,'#8098b0'],
['electronics','Electronics',0.40,0,0.30,0.40,'#9888a8'],
['homegoods','Home Goods',0.70,0,0.30,0.50,'#90a888'],
['checkout','Checkout',0.30,0.80,0.40,0.20,'#b0a8a0'],
['fitting','Fitting Rooms',0,0.40,0.30,0.40,'#80a0a0'],
['service','Cust. Service',0.70,0.50,0.30,0.50,'#b8a070']],
archetypes:[['Bargain Hunter',4,6,1.3],['Browser',8,5,0.7],['Loyal Customer',7,6,1.0],['Impatient Shopper',2,7,1.5],['Parent w/ Kids',3,4,0.8]],
dialogues:{enter:['{name} grabs a basket.','{name} checks the sale signs.'],explore:['{name} browses {zone}.','{name} picks up an item, puts it back.'],queue:['{name}: Only two registers open?!','{name} waits in the checkout line.'],frustrated:['{name}: Nothing in my size!','{name}: Where is the staff?'],satisfied:['{name}: Great deal on this!','{name}: Love the selection here.'],exit:['{name} leaves with bags.','{name} heads out empty-handed.']},
needs:['looking for a specific brand','wants to return an item','needs a gift idea','hunting for clearance deals','needs help with sizing']},

themePark:{name:'Theme Park',zones:[
['maingate','Main Gate',0.35,0.80,0.30,0.20,'#90b870'],
['coaster','Roller Coaster',0,0,0.35,0.40,'#c07060'],
['waterride','Water Ride',0.35,0,0.30,0.40,'#60a8b0'],
['foodcourt','Food Court',0.65,0,0.35,0.35,'#c8a060'],
['giftshop','Gift Shop',0,0.80,0.35,0.20,'#70a868'],
['kidszone','Kids Zone',0,0.40,0.35,0.40,'#8870a0'],
['showstage','Show Stage',0.35,0.40,0.30,0.40,'#b07098'],
['arcade','Arcade',0.65,0.35,0.35,0.45,'#6088b0']],
archetypes:[['Thrill Seeker',3,7,1.5],['Family Group',6,4,0.7],['Teenager',4,9,1.4],['Senior Visitor',8,3,0.5],['Birthday Kid',5,5,1.2]],
dialogues:{enter:['{name} rushes through the gates!','{name} grabs a park map.'],explore:['{name} runs toward {zone}.','{name} looks at the ride times.'],queue:['{name}: 90 minutes for one ride?!','{name} waits, bouncing with excitement.'],frustrated:['{name}: Everything is too expensive!','{name}: This queue hasn\'t moved.'],satisfied:['{name}: Best ride ever!','{name}: That show was amazing!'],exit:['{name} leaves, exhausted but happy.','{name} buys a souvenir on the way out.']},
needs:['wants to ride the coaster','looking for character meet','needs shade and water','wants to see the show','hunting for the gift shop']},

hotel:{name:'Hotel',zones:[
['lobby','Lobby',0,0,0.40,0.35,'#c8b890'],
['frontdesk','Front Desk',0.40,0,0.30,0.25,'#b0a080'],
['restaurant','Restaurant',0,0.35,0.40,0.35,'#9a8068'],
['pool','Pool Area',0.70,0,0.30,0.50,'#70a8a8'],
['conference','Conference Rm',0,0.70,0.50,0.30,'#6878a0'],
['elevator','Elevator Hall',0.40,0.25,0.30,0.25,'#a8a098'],
['bar','Bar',0.40,0.50,0.30,0.20,'#a07078'],
['spa','Spa',0.50,0.75,0.50,0.25,'#9088a0']],
archetypes:[['Business Guest',3,9,1.3],['Tourist',6,5,1.0],['Honeymooner',8,6,0.7],['Conference Attendee',4,8,1.2],['VIP Guest',2,7,1.1]],
dialogues:{enter:['{name} approaches the front desk.','{name} rolls luggage into the lobby.'],explore:['{name} explores {zone}.','{name} checks the amenities.'],queue:['{name}: Check-in is taking forever.','{name} waits with luggage.'],frustrated:['{name}: The room isn\'t ready?!','{name}: No hot water, seriously?'],satisfied:['{name}: Beautiful room.','{name}: The pool is perfect.'],exit:['{name} checks out smoothly.','{name} tips the bellhop.']},
needs:['wants an early check-in','looking for the gym','needs extra towels','wants a room upgrade','looking for the business center']},

council:{name:'Council Office',zones:[
['reception','Reception',0,0,0.40,0.30,'#b8b0a0'],
['waiting','Waiting Area',0,0.30,0.40,0.40,'#a8a090'],
['counters','Service Counters',0.40,0,0.60,0.35,'#8898a8'],
['manager','Manager Office',0.40,0.35,0.30,0.30,'#909880'],
['documents','Doc Collection',0.70,0.35,0.30,0.30,'#a8a888'],
['infoboard','Info Board',0,0.70,0.35,0.30,'#808898'],
['selfserve','Self-Service',0.35,0.70,0.35,0.30,'#8a9880'],
['exit','Exit Hall',0.70,0.65,0.30,0.35,'#a8a8a8']],
archetypes:[['First-Timer',6,4,0.8],['Regular Visitor',7,6,1.0],['Frustrated Citizen',2,5,1.3],['Elderly Resident',8,2,0.4],['Non-Native Speaker',5,4,0.7]],
dialogues:{enter:['{name} takes a number.','{name} reads the notice board.'],explore:['{name} looks for the right counter in {zone}.','{name} checks the form requirements.'],queue:['{name}: I\'ve been here two hours!','{name} stares at the number display.'],frustrated:['{name}: Wrong form, again!','{name}: Nobody can help me.'],satisfied:['{name}: Finally sorted!','{name}: That clerk was helpful.'],exit:['{name} leaves with documents.','{name} walks out, relieved.']},
needs:['needs to renew a permit','filing a complaint','paying a fine','requesting a certificate','updating address records']},

trainStation:{name:'Train Station',zones:[
['tickethall','Ticket Hall',0,0,0.40,0.35,'#989898'],
['platform1','Platform 1',0,0.35,0.50,0.30,'#888888'],
['platform2','Platform 2',0,0.65,0.50,0.35,'#a89878'],
['waitroom','Waiting Room',0.40,0,0.30,0.35,'#907858'],
['coffee','Coffee Shop',0.70,0,0.30,0.30,'#8890a0'],
['infopoint','Info Point',0.50,0.35,0.20,0.30,'#a09888'],
['passage','Main Passage',0.50,0.65,0.50,0.35,'#787878'],
['shops','Station Shops',0.70,0.30,0.30,0.35,'#a88068']],
archetypes:[['Commuter',3,8,1.5],['Tourist',6,4,0.8],['Student',5,9,1.2],['Late Runner',1,6,2.0],['Family Traveler',6,5,0.7]],
dialogues:{enter:['{name} checks the departures board.','{name} rushes in.'],explore:['{name} looks for platform info in {zone}.','{name} checks the timetable.'],queue:['{name}: The ticket machine is broken!','{name} waits at the counter.'],frustrated:['{name}: Delayed AGAIN?!','{name}: Wrong platform, great.'],satisfied:['{name}: Train is on time!','{name}: Nice coffee while waiting.'],exit:['{name} boards the train.','{name} exits through the barriers.']},
needs:['needs the right platform','looking for the loo','wants a coffee','running for a connection','needs to buy a ticket']},

university:{name:'University Campus',zones:[
['mainhall','Main Hall',0,0,0.35,0.35,'#a8a898'],
['lectureA','Lecture Room A',0.35,0,0.35,0.35,'#909098'],
['library','Library',0.70,0,0.30,0.45,'#98886a'],
['cafeteria','Cafeteria',0,0.35,0.35,0.30,'#a09070'],
['admin','Admin Office',0.35,0.35,0.35,0.30,'#8898a0'],
['lounge','Student Lounge',0,0.65,0.40,0.35,'#9080a0'],
['lab','Computer Lab',0.70,0.45,0.30,0.20,'#7888a8'],
['quad','Quad',0.40,0.65,0.60,0.35,'#80a078']],
archetypes:[['Freshman',5,7,1.0],['Senior Student',7,9,1.1],['Professor',8,6,0.8],['Parent Visitor',6,4,0.7],['International Student',5,5,0.9]],
dialogues:{enter:['{name} checks the campus map.','{name} walks across the quad.'],explore:['{name} looks for a seat in {zone}.','{name} checks the bulletin board.'],queue:['{name}: Enrollment line is massive.','{name} waits for the printer.'],frustrated:['{name}: Class is full?!','{name}: The WiFi is down again.'],satisfied:['{name}: Great lecture today.','{name}: Love this library.'],exit:['{name} heads home.','{name} catches the campus shuttle.']},
needs:['needs to find the registrar','looking for a study room','wants coffee','has an assignment due','looking for a professor']},

restaurant:{name:'Restaurant',zones:[
['entrance','Entrance',0.40,0.80,0.20,0.20,'#a8a098'],
['hoststand','Host Stand',0.40,0.60,0.20,0.20,'#a89878'],
['dining','Dining Area',0,0,0.60,0.60,'#b8a070'],
['bar','Bar',0.60,0,0.40,0.35,'#886870'],
['kitchen','Kitchen View',0,0.60,0.40,0.40,'#a0a0a0'],
['patio','Patio',0.60,0.35,0.40,0.35,'#80a070'],
['restrooms','Restrooms',0.60,0.70,0.40,0.30,'#909098']],
archetypes:[['Food Critic',7,6,0.6],['Date Night',8,5,0.7],['Family Diner',4,4,0.8],['Solo Diner',6,7,1.0],['Large Party',3,4,0.9]],
dialogues:{enter:['{name} checks the menu outside.','{name} approaches the host stand.'],explore:['{name} looks around {zone}.','{name} reads the menu.'],queue:['{name}: 45-minute wait?!','{name} puts name on the list.'],frustrated:['{name}: We ordered ages ago!','{name}: This table is sticky.'],satisfied:['{name}: Delicious!','{name}: Great atmosphere.'],exit:['{name} pays the bill.','{name} leaves a generous tip.']},
needs:['wants a window seat','has food allergies','celebrating an anniversary','wants the chef\'s special','needs a high chair']},

bank:{name:'Bank',zones:[
['entrance','Entrance',0.35,0.80,0.25,0.20,'#b0b0a8'],
['queue','Queue Area',0,0.40,0.40,0.40,'#a8a090'],
['tellers','Teller Windows',0,0,0.60,0.40,'#7888a8'],
['atm','ATM Zone',0.60,0,0.40,0.30,'#8898a0'],
['advisory','Advisory Desks',0.60,0.30,0.40,0.35,'#687898'],
['vault','Vault View',0.40,0.40,0.20,0.40,'#787880'],
['lounge','Waiting Lounge',0.60,0.65,0.40,0.35,'#a89878']],
archetypes:[['Quick Transaction',4,8,1.4],['Loan Applicant',6,5,0.8],['Confused Elder',8,2,0.5],['Business Owner',3,7,1.2],['Student Account',5,9,1.1]],
dialogues:{enter:['{name} takes a queue ticket.','{name} checks the service board.'],explore:['{name} looks for the right desk in {zone}.','{name} fills out a form.'],queue:['{name}: Three tellers and two are closed!','{name} watches the number screen.'],frustrated:['{name}: I just need a simple transfer!','{name}: This paperwork is insane.'],satisfied:['{name}: Quick and easy.','{name}: The advisor was helpful.'],exit:['{name} folds the receipt.','{name} leaves the bank.']},
needs:['needs a wire transfer','opening a new account','disputing a charge','applying for a loan','updating contact info']},

sportsArena:{name:'Sports Arena',zones:[
['gates','Entry Gates',0.30,0.80,0.40,0.20,'#989890'],
['concourse','Concourse',0,0.50,1.0,0.15,'#888880'],
['sectionA','Section A',0,0,0.50,0.50,'#6880a0'],
['sectionB','Section B',0.50,0,0.50,0.50,'#607090'],
['concession','Concessions',0,0.65,0.35,0.15,'#a89870'],
['merch','Merch Shop',0.65,0.65,0.35,0.15,'#a87870'],
['restrooms','Restrooms',0.35,0.65,0.30,0.15,'#8898a0']],
archetypes:[['Die-Hard Fan',3,6,1.3],['Casual Viewer',7,7,0.9],['Family Outing',5,4,0.7],['First Timer',6,5,1.0],['Season Holder',4,8,1.2]],
dialogues:{enter:['{name} shows the ticket at the gate.','{name} grabs a program.'],explore:['{name} finds a spot in {zone}.','{name} looks for seats.'],queue:['{name}: This beer line is ridiculous!','{name} waits for nachos.'],frustrated:['{name}: Can\'t see from here!','{name}: Sit down in front!'],satisfied:['{name}: GOAAAL!','{name}: What an atmosphere!'],exit:['{name} joins the crowd heading out.','{name} grabs a scarf from the merch shop.']},
needs:['wants a better view','looking for food','needs the restroom','wants to buy a jersey','trying to find friends']}
};

export const BASE_DIALOGUES = {
enter:['{name} walks in and looks around.','{name} arrives.'],
explore:['{name} wanders through {zone}.','{name} looks around.'],
queue:['{name}: How long is this queue?','{name} waits impatiently.'],
frustrated:['{name}: This is terrible!','{name} mutters something.','{name}: Where is the staff?'],
satisfied:['{name}: Not bad at all.','{name} nods approvingly.'],
exit:['{name} heads toward the exit.','{name} leaves.']
};
