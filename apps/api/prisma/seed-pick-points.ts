import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PICK_POINTS: Array<{ province: string; name: string; address: string }> =
  [
    // Maputo Cidade (15)
    { province: "Maputo Cidade", name: "Shoprite Sommerschield", address: "Av. Julius Nyerere, nº 3720, Sommerschield, Maputo" },
    { province: "Maputo Cidade", name: "Mercado Janete", address: "Av. 24 de Julho, nº 1150, Polana, Maputo" },
    { province: "Maputo Cidade", name: "Shoprite Machava", address: "EN4, Machava, Matola, Maputo" },
    { province: "Maputo Cidade", name: "Mal&Bem Boutique Hub", address: "Rua da Resistência, nº 255, Maputo" },
    { province: "Maputo Cidade", name: "Game Storeroom", address: "Shopping Maputo, Av. 25 de Setembro, nº 420" },
    { province: "Maputo Cidade", name: "Suanee Flagship", address: "Av. Karl Marx, nº 80, Maputo Centro" },
    { province: "Maputo Cidade", name: "Pick & Pay Polana", address: "Av. Mao Tse Tung, nº 1420, Polana, Maputo" },
    { province: "Maputo Cidade", name: "Loja Kassuende", address: "Bairro de Kassuende, R. da Unidade, nº 300, Maputo" },
    { province: "Maputo Cidade", name: "Centro Comercial Baixa", address: "Av. 25 de Setembro, nº 190, Baixa, Maputo" },
    { province: "Maputo Cidade", name: "Maxaquene Point", address: "Bairro Maxaquene B, R. 1.400, nº 22, Maputo" },
    { province: "Maputo Cidade", name: "Benfica Fashion Hub", address: "Bairro Benfica, Av. de Moçambique, nº 870" },
    { province: "Maputo Cidade", name: "Costa do Sol Pickup", address: "Av. Marginal, Costa do Sol, Maputo" },
    { province: "Maputo Cidade", name: "Aeroporto Logística", address: "Aeroporto Internacional de Maputo, Terminal de Carga" },
    { province: "Maputo Cidade", name: "Alto Maé Collect", address: "Av. Ho Chi Minh, nº 580, Alto Maé, Maputo" },
    { province: "Maputo Cidade", name: "Xipamanine Market Point", address: "Mercado de Xipamanine, Av. Patrice Lumumba, Maputo" },

    // Maputo Província (15)
    { province: "Maputo Província", name: "Matola Rio", address: "EN4, Bairro do Rio, Matola" },
    { province: "Maputo Província", name: "Boane Centro", address: "R. Principal, Boane Sede, Boane" },
    { province: "Maputo Província", name: "Marracuene Pickup", address: "EN1, Zona Industrial, Marracuene" },
    { province: "Maputo Província", name: "Manhiça Hub", address: "Av. 25 de Junho, nº 110, Manhiça" },
    { province: "Maputo Província", name: "Namaacha Collect", address: "R. da República, nº 45, Namaacha" },
    { province: "Maputo Província", name: "Matutuine Point", address: "Ponta do Ouro Road, Matutuine" },
    { province: "Maputo Província", name: "Moamba Loja", address: "Bairro Central, Moamba Sede" },
    { province: "Maputo Província", name: "KaTembe Ferry Point", address: "Terminal da Barca de KaTembe, Maputo" },
    { province: "Maputo Província", name: "Machava Norte", address: "EN4 km 12, Machava Norte, Matola" },
    { province: "Maputo Província", name: "Magude Collect", address: "Av. Samora Machel, nº 33, Magude" },
    { province: "Maputo Província", name: "Cidade da Matola Centro", address: "Av. das FPLM, nº 200, Matola" },
    { province: "Maputo Província", name: "Tsalala Point", address: "Estrada de Tsalala, Matola H" },
    { province: "Maputo Província", name: "Ressano Garcia Fronteira", address: "Posto Fronteiriço de Ressano Garcia" },
    { province: "Maputo Província", name: "Chibuto Delivery", address: "EN1, Entrada de Chibuto, Maputo Prov." },
    { province: "Maputo Província", name: "Palmeiras Hub", address: "Bairro Palmeiras, Matola" },

    // Gaza (15)
    { province: "Gaza", name: "Xai-Xai Centro", address: "Av. Eduardo Mondlane, nº 120, Xai-Xai" },
    { province: "Gaza", name: "Chókwè Market", address: "Mercado Municipal, Chókwè" },
    { province: "Gaza", name: "Chibuto Hub", address: "R. 1 de Maio, nº 88, Chibuto" },
    { province: "Gaza", name: "Guijá Collect", address: "Sede do Distrito de Guijá" },
    { province: "Gaza", name: "Macia Point", address: "Paragem de Macia, EN1, Macia" },
    { province: "Gaza", name: "Manjacaze Loja", address: "Bairro Central, Manjacaze Sede" },
    { province: "Gaza", name: "Bilene Beach Pickup", address: "Lagoa de Bilene, Acesso Sul" },
    { province: "Gaza", name: "Limpopo Hub", address: "Av. da Liberdade, nº 15, Xai-Xai" },
    { province: "Gaza", name: "Chicualacuala Collect", address: "Posto Fronteiriço de Chicualacuala" },
    { province: "Gaza", name: "Massangena Point", address: "Sede do Distrito de Massangena" },
    { province: "Gaza", name: "Funhalouro Hub", address: "R. Principal, Funhalouro Sede" },
    { province: "Gaza", name: "Xai-Xai Baixa", address: "Baixa de Xai-Xai, R. do Comércio, nº 50" },
    { province: "Gaza", name: "Mabalane Collect", address: "Sede de Mabalane, Gaza" },
    { province: "Gaza", name: "Ponta do Leste", address: "Paragem de Chongoene, EN1" },
    { province: "Gaza", name: "Muambula Point", address: "EN1 km 320, Posto de Serviço" },

    // Inhambane (15)
    { province: "Inhambane", name: "Inhambane Cidade", address: "Av. Acordos de Lusaka, nº 180, Inhambane" },
    { province: "Inhambane", name: "Tofo Beach Pickup", address: "Praia do Tofo, R. Principal, Inhambane" },
    { province: "Inhambane", name: "Maxixe Hub", address: "Av. das Indústrias, nº 30, Maxixe" },
    { province: "Inhambane", name: "Vilankulo Airport Point", address: "Aeroporto de Vilankulo, Vilankulo" },
    { province: "Inhambane", name: "Vilankulo Centro", address: "R. do Bazaruto, nº 15, Vilankulo" },
    { province: "Inhambane", name: "Zavala Collect", address: "Sede do Distrito de Zavala" },
    { province: "Inhambane", name: "Govuro Hub", address: "Bairro Central, Govuro Sede" },
    { province: "Inhambane", name: "Massinga Point", address: "Av. da República, nº 44, Massinga" },
    { province: "Inhambane", name: "Morrumbene Loja", address: "R. Principal, Morrumbene Sede" },
    { province: "Inhambane", name: "Mabote Collect", address: "Sede do Distrito de Mabote" },
    { province: "Inhambane", name: "Funhalouro Sul", address: "Paragem de Funhalouro, EN" },
    { province: "Inhambane", name: "Panda Pickup", address: "R. da Independência, Panda Sede" },
    { province: "Inhambane", name: "Homoíne Hub", address: "Av. Samora Machel, nº 22, Homoíne" },
    { province: "Inhambane", name: "Inhassoro Beach Point", address: "Praia de Inhassoro, R. do Oceano" },
    { province: "Inhambane", name: "Jangamo Loja", address: "Sede do Distrito de Jangamo" },

    // Sofala (15)
    { province: "Sofala", name: "Beira Centro Comercial", address: "R. Correia de Brito, nº 350, Beira" },
    { province: "Sofala", name: "Beira Shoprite", address: "Shopping de Beira, Av. FPLM, Beira" },
    { province: "Sofala", name: "Dondo Hub", address: "R. da Indústria, nº 10, Dondo" },
    { province: "Sofala", name: "Búzi Collect", address: "Sede do Distrito do Búzi" },
    { province: "Sofala", name: "Caia River Point", address: "Margem Norte do Zambeze, Caia" },
    { province: "Sofala", name: "Gorongosa Park Pickup", address: "Portão de Entrada, Parque de Gorongosa" },
    { province: "Sofala", name: "Marromeu Loja", address: "Av. Setembro, nº 5, Marromeu" },
    { province: "Sofala", name: "Nhamatanda Hub", address: "R. Principal, Nhamatanda Sede" },
    { province: "Sofala", name: "Cheringoma Collect", address: "Sede do Distrito de Cheringoma" },
    { province: "Sofala", name: "Beira Aeroporto Logística", address: "Aeroporto da Beira, Terminal de Carga" },
    { province: "Sofala", name: "Machanga Point", address: "Sede do Distrito de Machanga" },
    { province: "Sofala", name: "Muanza Collect", address: "Sede do Distrito de Muanza" },
    { province: "Sofala", name: "Beira Praia Nova", address: "Av. da Marginal, Praia Nova, Beira" },
    { province: "Sofala", name: "Chemba Hub", address: "Sede do Distrito de Chemba" },
    { province: "Sofala", name: "Chibabava Loja", address: "R. Principal, Chibabava Sede" },

    // Manica (15)
    { province: "Manica", name: "Chimoio Centro", address: "Av. 25 de Setembro, nº 300, Chimoio" },
    { province: "Manica", name: "Chimoio Shoprite", address: "Shopping Chimoio, EN6, Chimoio" },
    { province: "Manica", name: "Manica Town Hub", address: "R. da República, nº 80, Manica" },
    { province: "Manica", name: "Gondola Collect", address: "Paragem de Gondola, EN6" },
    { province: "Manica", name: "Sussundenga Point", address: "Sede do Distrito de Sussundenga" },
    { province: "Manica", name: "Mossurize Loja", address: "Sede do Distrito de Mossurize" },
    { province: "Manica", name: "Tambara Hub", address: "R. Principal, Tambara Sede" },
    { province: "Manica", name: "Barue Collect", address: "Sede do Distrito do Barué" },
    { province: "Manica", name: "Machaze Point", address: "Sede do Distrito de Machaze" },
    { province: "Manica", name: "Vanduzi Hub", address: "EN6, Vanduzi, Manica" },
    { province: "Manica", name: "Espungabera Collect", address: "Sede do Distrito de Mossurize, Espungabera" },
    { province: "Manica", name: "Catandica Loja", address: "R. 7 de Abril, nº 12, Catandica" },
    { province: "Manica", name: "Chimoio Aeroporto", address: "Aeroporto de Chimoio, Av. das FPLM" },
    { province: "Manica", name: "Penhalonga Point", address: "Mina de Penhalonga, Manica" },
    { province: "Manica", name: "Rotanda Collect", address: "EN6 km 180, Posto de Paragem, Manica" },

    // Tete (15)
    { province: "Tete", name: "Tete Cidade Hub", address: "Av. Eduardo Mondlane, nº 210, Tete" },
    { province: "Tete", name: "Moatize Coal Point", address: "Av. da Indústria, nº 5, Moatize" },
    { province: "Tete", name: "Songo Cahora Bassa", address: "Aldeia de Songo, Barragem de Cahora Bassa" },
    { province: "Tete", name: "Ulónguè Hub", address: "Sede do Distrito de Angónia, Ulónguè" },
    { province: "Tete", name: "Changara Collect", address: "R. Principal, Changara Sede" },
    { province: "Tete", name: "Zumbo River Point", address: "Margem do Rio Zambeze, Zumbo" },
    { province: "Tete", name: "Fingoè Loja", address: "Sede do Distrito de Tsangano, Fingoè" },
    { province: "Tete", name: "Macanga Hub", address: "Sede do Distrito de Macanga" },
    { province: "Tete", name: "Chiúta Collect", address: "Sede do Distrito de Chiúta" },
    { province: "Tete", name: "Marara Point", address: "Sede do Distrito de Marara" },
    { province: "Tete", name: "Magoe Loja", address: "Sede do Distrito de Magoè" },
    { province: "Tete", name: "Tete Bridge Pickup", address: "Ponte Internacional de Tete, EN103" },
    { province: "Tete", name: "Dôa Collect", address: "Sede do Distrito de Dôa" },
    { province: "Tete", name: "Furancungo Hub", address: "Sede do Distrito de Macanga, Furancungo" },
    { province: "Tete", name: "Chitima Loja", address: "Sede do Distrito de Cahora Bassa, Chitima" },

    // Zambézia (15)
    { province: "Zambézia", name: "Quelimane Centro", address: "Av. 1 de Julho, nº 400, Quelimane" },
    { province: "Zambézia", name: "Quelimane Shoprite", address: "Shopping Quelimane, Av. Samora Machel" },
    { province: "Zambézia", name: "Gurúè Tea Hub", address: "R. do Chá, nº 18, Gurúè" },
    { province: "Zambézia", name: "Mocuba Centro", address: "Av. da Independência, nº 55, Mocuba" },
    { province: "Zambézia", name: "Milange Border Point", address: "Posto Fronteiriço de Milange" },
    { province: "Zambézia", name: "Alto Molócuè Collect", address: "Sede do Distrito do Alto Molócuè" },
    { province: "Zambézia", name: "Pebane Coast Hub", address: "Bairro Costeiro, Pebane Sede" },
    { province: "Zambézia", name: "Morrumbala Loja", address: "Sede do Distrito de Morrumbala" },
    { province: "Zambézia", name: "Namacurra Point", address: "EN103, Namacurra Sede" },
    { province: "Zambézia", name: "Nicoadala Hub", address: "EN1, Nicoadala Sede" },
    { province: "Zambézia", name: "Lugela Collect", address: "Sede do Distrito de Lugela" },
    { province: "Zambézia", name: "Ile Hub", address: "Sede do Distrito de Ile" },
    { province: "Zambézia", name: "Maganja da Costa", address: "Sede do Distrito da Maganja da Costa" },
    { province: "Zambézia", name: "Chinde River Point", address: "Margem do Zambeze, Chinde Sede" },
    { province: "Zambézia", name: "Quelimane Aeroporto", address: "Aeroporto de Quelimane, Terminal Principal" },

    // Nampula (15)
    { province: "Nampula", name: "Nampula Shoprite", address: "Shopping Nampula, EN1, Nampula" },
    { province: "Nampula", name: "Nampula Centro", address: "Av. Eduardo Mondlane, nº 550, Nampula" },
    { province: "Nampula", name: "Ilha de Moçambique Hub", address: "R. do Hospital, nº 10, Ilha de Moçambique" },
    { province: "Nampula", name: "Nacala Porto Point", address: "Porto de Nacala, Zona Franca" },
    { province: "Nampula", name: "Angoche Coast Pickup", address: "Av. do Mar, nº 30, Angoche" },
    { province: "Nampula", name: "Monapo Hub", address: "EN1, Paragem de Monapo" },
    { province: "Nampula", name: "Meconta Collect", address: "Sede do Distrito de Meconta" },
    { province: "Nampula", name: "Ribáuè Point", address: "Sede do Distrito de Ribáuè" },
    { province: "Nampula", name: "Muecate Loja", address: "Sede do Distrito de Muecate" },
    { province: "Nampula", name: "Lalaua Hub", address: "Sede do Distrito de Lalaua" },
    { province: "Nampula", name: "Memba Coast Collect", address: "Sede do Distrito de Memba" },
    { province: "Nampula", name: "Mogincual Point", address: "Sede do Distrito de Mogincual" },
    { province: "Nampula", name: "Larde Hub", address: "Sede do Distrito de Moma, Larde" },
    { province: "Nampula", name: "Nampula Aeroporto", address: "Aeroporto Internacional de Nampula" },
    { province: "Nampula", name: "Eráti Collect", address: "Sede do Distrito de Eráti" },

    // Cabo Delgado (15)
    { province: "Cabo Delgado", name: "Pemba Cidade Hub", address: "Av. 25 de Setembro, nº 88, Pemba" },
    { province: "Cabo Delgado", name: "Pemba Beach Pickup", address: "Wimbe Beach, Pemba" },
    { province: "Cabo Delgado", name: "Montepuez Centro", address: "Av. da Independência, nº 42, Montepuez" },
    { province: "Cabo Delgado", name: "Mocímboa da Praia", address: "R. Principal, Mocímboa da Praia" },
    { province: "Cabo Delgado", name: "Mueda Hub", address: "Sede do Distrito de Mueda" },
    { province: "Cabo Delgado", name: "Macomia Collect", address: "Sede do Distrito de Macomia" },
    { province: "Cabo Delgado", name: "Quissanga Point", address: "Sede do Distrito de Quissanga" },
    { province: "Cabo Delgado", name: "Ibo Island Loja", address: "Ilha do Ibo, Arquipélago das Quirimbas" },
    { province: "Cabo Delgado", name: "Meluco Hub", address: "Sede do Distrito de Meluco" },
    { province: "Cabo Delgado", name: "Nangade Collect", address: "Sede do Distrito de Nangade" },
    { province: "Cabo Delgado", name: "Muidumbe Point", address: "Sede do Distrito de Muidumbe" },
    { province: "Cabo Delgado", name: "Chiure Hub", address: "Sede do Distrito de Chiure" },
    { province: "Cabo Delgado", name: "Metuge Loja", address: "Sede do Distrito de Metuge" },
    { province: "Cabo Delgado", name: "Ancuabe Collect", address: "Sede do Distrito de Ancuabe" },
    { province: "Cabo Delgado", name: "Pemba Aeroporto", address: "Aeroporto de Pemba, Terminal Principal" },

    // Niassa (15)
    { province: "Niassa", name: "Lichinga Centro", address: "Av. Samora Machel, nº 170, Lichinga" },
    { province: "Niassa", name: "Cuamba Hub", address: "R. do Mercado, nº 22, Cuamba" },
    { province: "Niassa", name: "Lago Niassa Point", address: "Margem do Lago Niassa, Metangula" },
    { province: "Niassa", name: "Mandimba Collect", address: "Sede do Distrito de Mandimba" },
    { province: "Niassa", name: "Mecanhelas Hub", address: "Sede do Distrito de Mecanhelas" },
    { province: "Niassa", name: "Majune Loja", address: "Sede do Distrito de Majune" },
    { province: "Niassa", name: "Muembe Point", address: "Sede do Distrito de Muembe" },
    { province: "Niassa", name: "Sanga Collect", address: "Sede do Distrito de Sanga" },
    { province: "Niassa", name: "Ngauma Hub", address: "Sede do Distrito de Ngauma" },
    { province: "Niassa", name: "Nipepe Loja", address: "Sede do Distrito de Nipepe" },
    { province: "Niassa", name: "Marrupa Point", address: "Sede do Distrito de Marrupa" },
    { province: "Niassa", name: "Mecula Collect", address: "Sede do Distrito de Mecula" },
    { province: "Niassa", name: "Chimbunila Hub", address: "Sede do Distrito de Chimbunila" },
    { province: "Niassa", name: "Lichinga Aeroporto", address: "Aeroporto de Lichinga, Terminal Principal" },
    { province: "Niassa", name: "Mavago Collect", address: "Sede do Distrito de Mavago" },
  ];

async function main() {
  console.log(`Seeding ${PICK_POINTS.length} pick points…`);
  const result = await prisma.pickPoint.createMany({
    data: PICK_POINTS,
    skipDuplicates: true,
  });
  console.log(`Created ${result.count} pick points.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
