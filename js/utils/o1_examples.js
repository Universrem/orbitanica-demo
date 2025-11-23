// Канонічні приклади з приблизними діаметрами — УСІ ЗНАЧЕННЯ В МЕТРАХ
// Структуровано від найменшого до найбільшого
export const O1_EXAMPLES = [
  { key: 'proton_1_7fm',            value_m: 1.7e-15 }, // Протон 1.7 фемтометра
  { key: 'helium_atom_62pm',        value_m: 6.2e-11 }, // Атом гелію 62 пікометра
  { key: 'carbon_atom_140pm',       value_m: 1.4e-10 }, // Атом вуглецю 140 пікометрів
  { key: 'h2_molecule_0_1nm',       value_m: 1e-10   }, // Молекула H₂ 0.1 нм
  { key: 'glucose_molecule_1nm',    value_m: 1e-9    }, // Молекула глюкози 1 нм
  { key: 'protein_10nm',            value_m: 1e-8    }, // Типовий білок 10 нм
  { key: 'dna_width_2nm',           value_m: 2e-9    }, // Ширина ДНК 2 нм
  { key: 'ribosome_25nm',           value_m: 2.5e-8  }, // Рибосома 25 нм
  { key: 'hiv_virus_120nm',         value_m: 1.2e-7  }, // Вірус ВІЛ 120 нм
  { key: 'virus_100nm',             value_m: 1e-7    }, // Типовий вірус 100 нм
  { key: 'bacterium_1um',           value_m: 1e-6    }, // Діаметр бактерії 1 мкм
  { key: 'red_blood_cell_7um',      value_m: 7e-6    }, // Еритроцит 7 мкм
  { key: 'cell_30um',               value_m: 3e-5    }, // Типова клітина 30 мкм
  { key: 'hair_70um',               value_m: 7e-5    }, // Товщина волосини 70 мкм
  { key: 'pollen_grain_100um',      value_m: 1e-4    }, // Пилок 100 мкм
  { key: 'dust_mite_300um',         value_m: 3e-4    }, // Пилковий кліщ 300 мкм
  { key: 'sand_grain_0_5mm',        value_m: 5e-4    }, // Пісчинка 0.5 мм
  { key: 'mm_1',                    value_m: 1e-3    }, // 1 міліметр
  { key: 'rice_grain_2mm',          value_m: 2e-3    }, // Зернятко рису 2 мм
  { key: 'ant_5mm',                 value_m: 5e-3    }, // Мураха 5 мм
  { key: 'cm_1',                    value_m: 1e-2    }, // 1 сантиметр
  { key: 'coin_25mm',               value_m: 0.025   }, // Монета 25 мм
  { key: 'walnut_3_5cm',            value_m: 0.035   }, // Волоський горіх 3.5 см
  { key: 'ping_pong_ball_4cm',      value_m: 0.040   }, // М'яч для пінг-понгу 4 см
  { key: 'golf_ball_4_3cm',         value_m: 0.043   }, // М'яч для гольфа 4.3 см
  { key: 'chicken_egg_5_5cm',       value_m: 0.055   }, // Куряче яйце 5.5 см
  { key: 'tennis_ball_6_7cm',       value_m: 0.067   }, // Тенісний м'яч 6.7 см
  { key: 'baseball_7_4cm',          value_m: 0.074   }, // Бейсбольний м'яч 7.4 см
  { key: 'cm_10',                   value_m: 0.10    }, // 10 сантиметрів
  { key: 'volleyball_21cm',         value_m: 0.21    }, // Волейбольний м'яч 21 см
  { key: 'soccer_ball_22cm',        value_m: 0.22    }, // Футбольний м'яч 22 см
  { key: 'basketball_24cm',         value_m: 0.24    }, // Баскетбольний м'яч 24 см
  { key: 'bike_wheel_55cm',         value_m: 0.55    }, // Колесо велосипеда 55 см
  { key: 'car_wheel_65cm',          value_m: 0.65    }, // Колесо автомобіля 65 см
  { key: 'person_footprint_75cm',   value_m: 0.75    }, // «Площа на 1 людину» ~ діаметр 75 см
  { key: 'm_1',                     value_m: 1       }, // 1 метр
  { key: 'table_tennis_table_2_74m',value_m: 2.74    }, // Стіл для настільного тенісу 2.74 м
  { key: 'car_length_4_5m',         value_m: 4.5     }, // Довжина автомобіля 4.5 м
  { key: 'parking_space_5m',        value_m: 5.0     }, // Довжина паркувального місця 5 м
  { key: 'school_bus_11m',          value_m: 11      }, // Шкільний автобус 11 м
  { key: 'bus_length_12m',          value_m: 12      }, // Довжина автобуса 12 м
  { key: 'truck_trailer_16m',       value_m: 16      }, // Причіп вантажівки 16 м
  { key: 'tennis_court_24m',        value_m: 24      }, // Довжина тенісного корту 23.77 м
  { key: 'swimming_pool_25m',       value_m: 25      }, // Басейн 25 м
  { key: 'railway_car_26m',         value_m: 26      }, // Залізничний вагон 26 м
  { key: 'basketball_court_28m',    value_m: 28      }, // Баскетбольний майданчик 28 м
  { key: 'blue_whale_30m',          value_m: 30      }, // Синій кит 30 м
  { key: 'boeing_737_length_39m',   value_m: 39      }, // Довжина Boeing 737: 39 м
  { key: 'statue_of_liberty_46m',   value_m: 46      }, // Статуя Свободи (без постаменту) 46 м
  { key: 'swimming_pool_50m',       value_m: 50      }, // Олімпійський басейн 50 м
  { key: 'soccer_field_width_68m',  value_m: 68      }, // Ширина футбольного поля 68 м
  { key: 'airbus_a380_length_73m',  value_m: 73      }, // Довжина Airbus A380: 73 м
  { key: 'airbus_a380_wingspan_80m',value_m: 80      }, // Розмах крил Airbus A380: 80 м
  { key: 'sprint_track_100m',       value_m: 100     }, // Спринтерська доріжка 100 м
  { key: 'soccer_field_105m',       value_m: 105     }, // Довжина футбольного поля 105 м
  { key: 'stadium_field_150m',      value_m: 150     }, // Поле стадіону ~ 150 м
  { key: 'city_block_200m',         value_m: 200     }, // Міський квартал ~ 200 м
  { key: 'titanic_length_269m',     value_m: 269     }, // Титанік 269 м
  { key: 'eiffel_tower_height_330m',value_m: 330     }, // Ейфелева вежа 330 м
  { key: 'cruise_ship_length_360m', value_m: 360     }, // Круїзний лайнер 360 м
  { key: 'empire_state_381m',       value_m: 381     }, // Емпайр-Стейт-Білдінг 381 м
  { key: 'burj_khalifa_828m',       value_m: 828     }, // Бурдж-Халіфа 828 м
  { key: 'golden_gate_bridge_span_1280m', value_m: 1280 }, // Прольот моста Золоті Ворота 1280 м
];

export const O1_EXAMPLES_GEO_POPULATION = [
  { key: 'pop_area_1',    value_m: 1.1  }, // Площа для 1 людини - 1,1 м
  { key: 'pop_area_10',   value_m: 3.6  }, // Площа для 10 людей - 3,6 м
  { key: 'pop_area_100',  value_m: 11.3 }, // Площа для 100 людей - 11,3 м
  { key: 'pop_area_1000', value_m: 35.7 }, // Площа для 1000 людей - 35,7 м
];

export const O1_EXAMPLES_UNIVERS_DISTANCE = [
 { key: 'h2_molecule_0_1nm',       value_m: 1e-10   }, // Молекула H₂ 0.1 нм
  { key: 'glucose_molecule_1nm',    value_m: 1e-9    }, // Молекула глюкози 1 нм
  { key: 'protein_10nm',            value_m: 1e-8    }, // Типовий білок 10 нм
  { key: 'dna_width_2nm',           value_m: 2e-9    }, // Ширина ДНК 2 нм
  { key: 'ribosome_25nm',           value_m: 2.5e-8  }, // Рибосома 25 нм
  { key: 'hiv_virus_120nm',         value_m: 1.2e-7  }, // Вірус ВІЛ 120 нм
  { key: 'virus_100nm',             value_m: 1e-7    }, // Типовий вірус 100 нм
  { key: 'bacterium_1um',           value_m: 1e-6    }, // Діаметр бактерії 1 мкм
  { key: 'red_blood_cell_7um',      value_m: 7e-6    }, // Еритроцит 7 мкм
  { key: 'cell_30um',               value_m: 3e-5    }, // Типова клітина 30 мкм
  { key: 'hair_70um',               value_m: 7e-5    }, // Товщина волосини 70 мкм
  { key: 'pollen_grain_100um',      value_m: 1e-4    }, // Пилок 100 мкм
  { key: 'dust_mite_300um',         value_m: 3e-4    }, // Пилковий кліщ 300 мкм
  { key: 'sand_grain_0_5mm',        value_m: 5e-4    }, // Пісчинка 0.5 мм
  { key: 'mm_1',                    value_m: 1e-3    }, // 1 міліметр
  { key: 'rice_grain_2mm',          value_m: 2e-3    }, // Зернятко рису 2 мм
  { key: 'ant_5mm',                 value_m: 5e-3    }, // Мураха 5 мм
  { key: 'cm_1',                    value_m: 1e-2    }, // 1 сантиметр
  { key: 'coin_25mm',               value_m: 0.025   }, // Монета 25 мм
  { key: 'walnut_3_5cm',            value_m: 0.035   }, // Волоський горіх 3.5 см
  { key: 'ping_pong_ball_4cm',      value_m: 0.040   }, // М'яч для пінг-понгу 4 см
  { key: 'golf_ball_4_3cm',         value_m: 0.043   }, // М'яч для гольфа 4.3 см
  { key: 'chicken_egg_5_5cm',       value_m: 0.055   }, // Куряче яйце 5.5 см
  { key: 'tennis_ball_6_7cm',       value_m: 0.067   }, // Тенісний м'яч 6.7 см
  { key: 'baseball_7_4cm',          value_m: 0.074   }, // Бейсбольний м'яч 7.4 см
  { key: 'cm_10',                   value_m: 0.10    }, // 10 сантиметрів
  { key: 'volleyball_21cm',         value_m: 0.21    }, // Волейбольний м'яч 21 см
  { key: 'soccer_ball_22cm',        value_m: 0.22    }, // Футбольний м'яч 22 см
  { key: 'basketball_24cm',         value_m: 0.24    }, // Баскетбольний м'яч 24 см
];
export const O1_EXAMPLES_UNIVERS_DIAMETER = [
  { key: 'cell_30um',               value_m: 3e-5    }, // Типова клітина 30 мкм
  { key: 'hair_70um',               value_m: 7e-5    }, // Товщина волосини 70 мкм
  { key: 'pollen_grain_100um',      value_m: 1e-4    }, // Пилок 100 мкм
  { key: 'dust_mite_300um',         value_m: 3e-4    }, // Пилковий кліщ 300 мкм
  { key: 'sand_grain_0_5mm',        value_m: 5e-4    }, // Пісчинка 0.5 мм
  { key: 'mm_1',                    value_m: 1e-3    }, // 1 міліметр
  { key: 'rice_grain_2mm',          value_m: 2e-3    }, // Зернятко рису 2 мм
  { key: 'ant_5mm',                 value_m: 5e-3    }, // Мураха 5 мм
  { key: 'cm_1',                    value_m: 1e-2    }, // 1 сантиметр
  { key: 'coin_25mm',               value_m: 0.025   }, // Монета 25 мм
  { key: 'walnut_3_5cm',            value_m: 0.035   }, // Волоський горіх 3.5 см
  { key: 'ping_pong_ball_4cm',      value_m: 0.040   }, // М'яч для пінг-понгу 4 см
  { key: 'golf_ball_4_3cm',         value_m: 0.043   }, // М'яч для гольфа 4.3 см
  { key: 'chicken_egg_5_5cm',       value_m: 0.055   }, // Куряче яйце 5.5 см
  { key: 'tennis_ball_6_7cm',       value_m: 0.067   }, // Тенісний м'яч 6.7 см
  { key: 'baseball_7_4cm',          value_m: 0.074   }, // Бейсбольний м'яч 7.4 см
  { key: 'cm_10',                   value_m: 0.10    }, // 10 сантиметрів
  { key: 'volleyball_21cm',         value_m: 0.21    }, // Волейбольний м'яч 21 см
  { key: 'soccer_ball_22cm',        value_m: 0.22    }, // Футбольний м'яч 22 см
  { key: 'basketball_24cm',         value_m: 0.24    }, // Баскетбольний м'яч 24 см
];
export const O1_EXAMPLES_UNIVERS_MASS = [
  { key: 'cell_30um',               value_m: 3e-5    }, // Типова клітина 30 мкм
  { key: 'hair_70um',               value_m: 7e-5    }, // Товщина волосини 70 мкм
  { key: 'pollen_grain_100um',      value_m: 1e-4    }, // Пилок 100 мкм
  { key: 'dust_mite_300um',         value_m: 3e-4    }, // Пилковий кліщ 300 мкм
  { key: 'sand_grain_0_5mm',        value_m: 5e-4    }, // Пісчинка 0.5 мм
  { key: 'mm_1',                    value_m: 1e-3    }, // 1 міліметр
  { key: 'rice_grain_2mm',          value_m: 2e-3    }, // Зернятко рису 2 мм
  { key: 'ant_5mm',                 value_m: 5e-3    }, // Мураха 5 мм
  { key: 'cm_1',                    value_m: 1e-2    }, // 1 сантиметр
  { key: 'coin_25mm',               value_m: 0.025   }, // Монета 25 мм
  { key: 'walnut_3_5cm',            value_m: 0.035   }, // Волоський горіх 3.5 см
  { key: 'ping_pong_ball_4cm',      value_m: 0.040   }, // М'яч для пінг-понгу 4 см
  { key: 'golf_ball_4_3cm',         value_m: 0.043   }, // М'яч для гольфа 4.3 см
  { key: 'chicken_egg_5_5cm',       value_m: 0.055   }, // Куряче яйце 5.5 см
  { key: 'tennis_ball_6_7cm',       value_m: 0.067   }, // Тенісний м'яч 6.7 см
  { key: 'baseball_7_4cm',          value_m: 0.074   }, // Бейсбольний м'яч 7.4 см
  { key: 'cm_10',                   value_m: 0.10    }, // 10 сантиметрів
  { key: 'volleyball_21cm',         value_m: 0.21    }, // Волейбольний м'яч 21 см
  { key: 'soccer_ball_22cm',        value_m: 0.22    }, // Футбольний м'яч 22 см
  { key: 'basketball_24cm',         value_m: 0.24    }, // Баскетбольний м'яч 24 см
];
export const O1_EXAMPLES_UNIVERS_LUMINOSITY = [
  { key: 'cm_1',                    value_m: 1e-2    }, // 1 сантиметр
  { key: 'coin_25mm',               value_m: 0.025   }, // Монета 25 мм
  { key: 'walnut_3_5cm',            value_m: 0.035   }, // Волоський горіх 3.5 см
  { key: 'ping_pong_ball_4cm',      value_m: 0.040   }, // М'яч для пінг-понгу 4 см
  { key: 'golf_ball_4_3cm',         value_m: 0.043   }, // М'яч для гольфа 4.3 см
  { key: 'chicken_egg_5_5cm',       value_m: 0.055   }, // Куряче яйце 5.5 см
  { key: 'tennis_ball_6_7cm',       value_m: 0.067   }, // Тенісний м'яч 6.7 см
  { key: 'baseball_7_4cm',          value_m: 0.074   }, // Бейсбольний м'яч 7.4 см
  { key: 'cm_10',                   value_m: 0.10    }, // 10 сантиметрів
  { key: 'volleyball_21cm',         value_m: 0.21    }, // Волейбольний м'яч 21 см
  { key: 'soccer_ball_22cm',        value_m: 0.22    }, // Футбольний м'яч 22 см
  { key: 'basketball_24cm',         value_m: 0.24    }, // Баскетбольний м'яч 24 см
  { key: 'bike_wheel_55cm',         value_m: 0.55    }, // Колесо велосипеда 55 см
  { key: 'car_wheel_65cm',          value_m: 0.65    }, // Колесо автомобіля 65 см
  { key: 'm_1',                     value_m: 1       }, // 1 метр
  { key: 'table_tennis_table_2_74m',value_m: 2.74    }, // Стіл для настільного тенісу 2.74 м
  { key: 'car_length_4_5m',         value_m: 4.5     }, // Довжина автомобіля 4.5 м
  { key: 'school_bus_11m',          value_m: 11      }, // Шкільний автобус 11 м
  { key: 'bus_length_12m',          value_m: 12      }, // Довжина автобуса 12 м
  { key: 'swimming_pool_25m',       value_m: 25      }, // Басейн 25 м
  { key: 'basketball_court_28m',    value_m: 28      }, // Баскетбольний майданчик 28 м
  { key: 'swimming_pool_50m',       value_m: 50      }, // Олімпійський басейн 50 м
  { key: 'soccer_field_width_68m',  value_m: 68      }, // Ширина футбольного поля 68 м
  { key: 'sprint_track_100m',       value_m: 100     }, // Спринтерська доріжка 100 м
];

export const O1_EXAMPLES_GEO_AREA = [
  { key: 'area_1_sq_ft',    value_m: 0.3439299701 }, // 1 ft², 0.09 м² - 0,34 м  
  { key: 'area_1_m2',      value_m: 1.1283791671 },  // 1 м² - 1,13 м
  { key: 'area_10_sq_ft',   value_m: 1.0876020612 }, // 10 ft², 0.93 м² - 1,09 м
  { key: 'area_100_sq_ft',  value_m: 3.4392997013 }, // 100 ft², 9.29 м² - 3,44 м  
  { key: 'area_10_m2',     value_m: 3.5682482323 },  // 10 м² - 3,57 м
  { key: 'area_1000_sq_ft', value_m: 10.8760206121 }, // 1000 ft², 92.90 м² - 10,88 м
  { key: 'area_1_sotka_100m2',        value_m: 11.2837916710 },  // 1 сотка (100 м²)
  { key: 'area_6_sotok_600m2',        value_m: 27.6395319577 },  // 6 соток (600 м²)
  { key: 'area_10_sotok_1000m2',      value_m: 35.6824823231 },  // 10 соток (1000 м²)
  { key: 'area_1_acre',               value_m: 71.7817360396 },  // 1 акр (~4046.8564224 м²)
  { key: 'area_1_hectare_10000m2',    value_m: 112.8379167096 }, // 1 гектар (10 000 м²)
  { key: 'area_10_hectares_100000m2', value_m: 356.8248232306 }, // 10 гектарів (100 000 м²)
  { key: 'area_1_square_km',          value_m: 1128.3791670955 },// 1 км²
  { key: 'area_1_square_mile',        value_m: 1815.9502422902 } // 1 квадратна миля
];

export const O1_EXAMPLES_GEO_OBJECTS = [
  { key: 'car_length_4_5m',         value_m: 4.5     }, // Довжина автомобіля 4.5 м
  { key: 'parking_space_5m',        value_m: 5.0     }, // Довжина паркувального місця 5 м
  { key: 'school_bus_11m',          value_m: 11      }, // Шкільний автобус 11 м
  { key: 'bus_length_12m',          value_m: 12      }, // Довжина автобуса 12 м
  { key: 'truck_trailer_16m',       value_m: 16      }, // Причіп вантажівки 16 м
  { key: 'tennis_court_24m',        value_m: 24      }, // Довжина тенісного корту 23.77 м
  { key: 'swimming_pool_25m',       value_m: 25      }, // Басейн 25 м
  { key: 'railway_car_26m',         value_m: 26      }, // Залізничний вагон 26 м
  { key: 'basketball_court_28m',    value_m: 28      }, // Баскетбольний майданчик 28 м
  { key: 'blue_whale_30m',          value_m: 30      }, // Синій кит 30 м
  { key: 'boeing_737_length_39m',   value_m: 39      }, // Довжина Boeing 737: 39 м
  { key: 'statue_of_liberty_46m',   value_m: 46      }, // Статуя Свободи (без постаменту) 46 м
  { key: 'swimming_pool_50m',       value_m: 50      }, // Олімпійський басейн 50 м
  { key: 'soccer_field_width_68m',  value_m: 68      }, // Ширина футбольного поля 68 м
  { key: 'airbus_a380_length_73m',  value_m: 73      }, // Довжина Airbus A380: 73 м
  { key: 'airbus_a380_wingspan_80m',value_m: 80      }, // Розмах крил Airbus A380: 80 м
  { key: 'sprint_track_100m',       value_m: 100     }, // Спринтерська доріжка 100 м
  { key: 'soccer_field_105m',       value_m: 105     }, // Довжина футбольного поля 105 м
  { key: 'stadium_field_150m',      value_m: 150     }, // Поле стадіону ~ 150 м
  { key: 'city_block_200m',         value_m: 200     }, // Міський квартал ~ 200 м
  { key: 'titanic_length_269m',     value_m: 269     }, // Титанік 269 м
  { key: 'eiffel_tower_height_330m',value_m: 330     }, // Ейфелева вежа 330 м
  { key: 'cruise_ship_length_360m', value_m: 360     }, // Круїзний лайнер 360 м
  { key: 'empire_state_381m',       value_m: 381     }, // Емпайр-Стейт-Білдінг 381 м
  { key: 'burj_khalifa_828m',       value_m: 828     }, // Бурдж-Халіфа 828 м
  { key: 'golden_gate_bridge_span_1280m', value_m: 1280 }, // Прольот моста Золоті Ворота 1280 м
];

export const O1_EXAMPLES_HISTORY = [
  { key: 'cm_1',                    value_m: 1e-2    }, // 1 сантиметр
  { key: 'cm_10',                   value_m: 0.10    }, // 10 сантиметрів
  { key: 'one_step',                value_m: 0.65    }, // Крок 65 сантиметрів
  { key: 'm_1',                     value_m: 1       }, // 1 метр
  ];
export const O1_EXAMPLES_MATH = [
  { key: 'rice_grain_2mm',          value_m: 2e-3    }, // Зернятко рису 2 мм
  { key: 'ant_5mm',                 value_m: 5e-3    }, // Мураха 5 мм
  { key: 'cm_1',                    value_m: 1e-2    }, // 1 сантиметр
  { key: 'coin_25mm',               value_m: 0.025   }, // Монета 25 мм
  { key: 'tennis_ball_6_7cm',       value_m: 0.067   }, // Тенісний м'яч 6.7 см
  { key: 'cm_10',                   value_m: 0.10    }, // 10 сантиметрів
  { key: 'soccer_ball_22cm',        value_m: 0.22    }, // Футбольний м'яч 22 см
  { key: 'basketball_24cm',         value_m: 0.24    }, // Баскетбольний м'яч 24 см
  { key: 'm_1',                     value_m: 1       }, // 1 метр
  ];

export const O1_EXAMPLES_MONEY = [
  { key: 'rice_grain_2mm',          value_m: 2e-3    }, // Площа монети 1 цент
  { key: 'ant_5mm',                 value_m: 5e-3    }, // Площа монети 1 євро/цент
  { key: 'coin_25mm',               value_m: 0.025   }, // Площа купьюри 100 доларів
  { key: 'tennis_ball_6_7cm',       value_m: 0.067   }, // Площа купьюри 100 євро
  { key: 'cm_10',                   value_m: 0.10    }, // Площа покриття 1000 доларів із купюр 100 доларів
  { key: 'soccer_ball_22cm',        value_m: 0.22    }, // Площа покриття 1000 євро із купюр 100 євро
  { key: 'basketball_24cm',         value_m: 0.24    }, // Площа покриття 1 млн. доларів із купюр 100 доларів
  { key: 'm_1',                     value_m: 1       }, // Площа покриття 1 млн. євро із купюр 100 євро
  ];

/**
 * Повертає масив прикладів для конкретного режиму.
 * modeId — внутрішній ключ режиму: 'univers_distance', 'geo_population', 'history' тощо.
 */
export function getO1ExamplesForMode(modeId) {
  switch (modeId) {
    case 'univers_distance':   return O1_EXAMPLES_UNIVERS_DISTANCE;
    case 'univers_diameter':   return O1_EXAMPLES_UNIVERS_DIAMETER;
    case 'univers_mass':       return O1_EXAMPLES_UNIVERS_MASS;
    case 'univers_luminosity': return O1_EXAMPLES_UNIVERS_LUMINOSITY;

    case 'geo_population': return O1_EXAMPLES_GEO_POPULATION;
    case 'geo_area':       return O1_EXAMPLES_GEO_AREA;
    case 'geo_objects':    return O1_EXAMPLES_GEO_OBJECTS;

    case 'history': return O1_EXAMPLES_HISTORY;
    case 'math':    return O1_EXAMPLES_MATH;
    case 'money':   return O1_EXAMPLES_MONEY;

    default:
      // Фолбек — базовий список діаметрів
      return O1_EXAMPLES;
  }
}
