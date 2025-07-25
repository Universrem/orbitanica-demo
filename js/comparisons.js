// js/comparisons.js
// ─────────────────────────────────────────────────────────────
// Конфігурація пар для sidebar.js (космос + географія)

export const comparisons = [
  /*─────────────────────  Космос  ─────────────────────*/
{
    category: "universe",
    label_ua: "Всесвіт",
    label_en: "Universe",
    label_es: "Universo",
    items: [
  {
    id      : '1',
    key     : 'sidebar.1',
    obj1    : 'Earth',
    obj2    : 'Sun',
    type    : 'diameter',
    circle1 : 2,
    marker1 : { src: '../res/Earth.png', size: [32,48], offset: [0,24] },
    marker2 : { src: '../res/Sun.png', size: [32,48], offset: [0,24] }
  },
  {
    id      : '2',
    key     : 'sidebar.2',
    obj1    : 'Solar System',
    obj2    : 'Sagittarius A*',
    type    : 'distance',
    circle1 : 100,
    marker1 : { src: '../res/Solar System.png', size: [32,48], offset: [0,24] },
    marker2 : { src: '../res/Sagittarius A.png',  size: [90,30], offset: [0,30] }
  },
  {
    id      : '3',
    key     : 'sidebar.3',
    obj1    : 'Sun',
    obj2    : 'Stephenson 2-18',
    type    : 'diameter',
    circle1 : 500,
    marker1 : { src: '../res/Sun.png', size: [32,48], offset: [0,24] },
    marker2 : { src: '../res/Stephenson 2-18.png', size: [32,48], offset: [0,24] }
  },
  {
    id      : '4',
    key     : 'sidebar.4',
    obj1    : 'Milky Way',
    obj2    : 'Edge of Observable Universe',
    type    : 'distance',
    circle1 : 2,
    marker1 : { src: '../res/Milky Way.png', size: [32,48], offset: [0,24] },
    marker2 : { src: '../res/Observable Universe.png', size: [32,48], offset: [0,24] }
  },
  {
    id      : '5',
    key     : 'sidebar.5',
    obj1    : 'Sun',
    obj2    : 'Proxima Centauri',
    type    : 'distance',
    circle1 : 0.1,
    marker1 : { src: '../res/Sun.png', size: [32,48], offset: [0,24] },
    marker2 : { src: '../res/Proxima Centauri.png', size: [32,48], offset: [0,24] }
  }
  ]
},
  /*────────────────────  Географія  ────────────────────*/
 {
    category: "geography",
    label_ua: "Географія",
    label_en: "Geography",
    label_es: "Geografía",
    items: [
  {
    id      : '6',
    key     : 'sidebar.geo6',
    obj1    : 'Population of Europe 2024',
    obj2    : 'Population of USA 2024',
    type    : 'value',
    field   : 'population',
    circle1 : 100000,
    marker1 : { src: '../res/Europe.png', size: [32,48], offset: [0,24] },
    marker2 : { src: '../res/USA.png', size: [32,48], offset: [0,24] }
  },
  {
    id      : '7',
    key     : 'sidebar.geo7',
    obj1    : 'Global Population 2024',
    obj2    : 'Population of China 2024',
    type    : 'value',
    field   : 'population',
    circle1 : 100000,
    marker1 : { src: '../res/Global.png', size: [32,48], offset: [0,24] },
    marker2 : { src: '../res/China.png', size: [32,48], offset: [0,24] }
  },
  {
    id      : '8',
    key     : 'sidebar.geo8',
    obj1    : 'Land Area of Europe',
    obj2    : 'Land Area of Earth',
    type    : 'value',
    field   : 'area',
    circle1 : 100000,
    marker1 : { src: '../res/Europe.png', size: [32,48], offset: [0,24] },
    marker2 : { src: '../res/Earth.png', size: [32,48], offset: [0,24] }
  },
  {
    id      : '9',
    key     : 'sidebar.geo9',
    obj1    : 'Water Area of Earth',
    obj2    : 'Land Area of Earth',
    type    : 'value',
    field   : 'area',
    circle1 : 100000,
    marker1 : { src: '../res/Water.png', size: [32,48], offset: [0,24] },
    marker2 : { src: '../res/Land.png', size: [32,48], offset: [0,24] }
  },
  {
    id      : '10',
    key     : 'sidebar.geo10',
    obj1    : 'Height of the Tallest Building (Burj Khalifa)',
    obj2    : 'Mount Everest Height',
    type    : 'value',
    field   : 'height',
    circle1 : 100,
    marker1 : { src: '../res/Burj Khalifa.png', size: [32,48], offset: [0,24] },
    marker2 : { src: '../res/Everest.png', size: [32,48], offset: [0,24] }
  },
]
},
  /*────────────── Історичні трійки ──────────────*/
{
    category: "history",
    label_ua: "Історичні події",
    label_en: "Historical Events",
    label_es: "Eventos Históricos",
    items: [
  {
    id      : '11',
    key     : 'sidebar.time11',
    obj1    : 'First human',
    obj2    : 'Formation of Earth',
    obj3    : 'Creation of the Universe',
    type    : 'time',
    circle1 : 100,
    marker1 : { src: '../res/First human.png', size: [32,48], offset: [0,24] },
    marker2 : { src: '../res/Earth.png', size: [32,48], offset: [0,24] },
    marker3 : { src: '../res/Universe.png', size: [32,48], offset: [0,24] }
  },
  {
    id      : '12',
    key     : 'sidebar.time12',
    obj1    : 'Construction of the Pyramids',
    obj2    : 'First human',
    obj3    : 'Extinction of the Dinosaurs',
    type    : 'time',
    circle1 : 200,
    marker1 : { src: '../res/Pyramids.png', size: [32,48], offset: [0,24] },
    marker2 : { src: '../res/First human.png', size: [32,48], offset: [0,24] },
    marker3 : { src: '../res/Dinosaurs.png', size: [32,48], offset: [0,24] }
  },
  {
    id      : '13',
    key     : 'sidebar.time13',
    obj1    : 'End of World War II',
    obj2    : 'End of World War I',
    obj3    : 'Crucifixion of Christ',
    type    : 'time',
    circle1 : 10000,
    marker1 : { src: '../res/War II.png', size: [32,48], offset: [0,24] },
    marker2 : { src: '../res/War I.png', size: [32,48], offset: [0,24] },
    marker3 : { src: '../res/Crucifixion.png', size: [32,48], offset: [0,24] }
  },
  {
    id      : '14',
    key     : 'sidebar.time14',
    obj1    : 'Discovery of America',
    obj2    : 'Completion of the Colosseum',
    obj3    : 'Founding of Rome',
    type    : 'time',
    circle1 : 10000,
    marker1 : { src: '../res/America.png', size: [32,48], offset: [0,24] },
    marker2 : { src: '../res/Colosseum.png', size: [32,48], offset: [0,24] },
    marker3 : { src: '../res/Rome.png', size: [32,48], offset: [0,24] }
  },
  {
    id      : '15',
    key     : 'sidebar.time15',
    obj1    : 'Wright Brothers’ First Flight',
    obj2    : 'First Automobile',
    obj3    : 'Invention of the Wheel',
    type    : 'time',
    circle1 : 10000,
    marker1 : { src: '../res/First Flight.png', size: [32,48], offset: [0,24] },
    marker2 : { src: '../res/First Automobile.png', size: [32,48], offset: [0,24] },
    marker3 : { src: '../res/First Wheel.png', size: [32,48], offset: [0,24] }
  }
    ]
  },  
  {
  category: "biology",
  label_ua: "Біологія",
  label_en: "Biology",
  label_es: "Biología",
  items: [
    {
      id      : "16",
      key     : "sidebar.bio16",
      obj1    : "Mosquito",
      obj2    : "Blue Whale",
      type    : "value",
      field   : "size",
      circle1 : 0.04,
      marker1 : { src: "../res/Mosquito.png", size: [32,48], offset: [0,24] },
      marker2 : { src: "../res/Blue Whale.png", size: [32,48], offset: [0,24] }
    }
  ]
},
{
  category: "mathematics",
  label_ua: "Математика",
  label_en: "Mathematics",
  label_es: "Matemáticas",
  items: [
    {
      id      : "17",
      key     : "sidebar.math17",
      obj1    : "One Million",
      obj2    : "One Billion",
      type    : "value",
      field   : "quantity",
      circle1 : 10,
      marker1 : { src: "../res/One Million.png", size: [32,48], offset: [0,24] },
      marker2 : { src: "../res/One Billion.png", size: [32,48], offset: [0,24] }
    }
  ]
},
{
  category: "money",
  label_ua: "Гроші",
  label_en: "Money",
  label_es: "Dinero",
  items: [
    {
      id      : "18",
      key     : "sidebar.money18",
      obj1    : "One Million Dollars",
      obj2    : "Elon Musk Net Worth 2024",
      type    : "value",
      field   : "money",
      circle1 : 1,
      marker1 : { src: "../res/Million dollars.png", size: [32,48], offset: [0,24] },
      marker2 : { src: "../res/350 billions.png", size: [32,48], offset: [0,24] }
    }
  ]
}

];


