// full/js/modes/builtin.js
'use strict';
import { registerMode } from './registry.js';

// 1) ініціалізатори блоків (UI-форма/випадайки режиму)
import { initUniversDiameterBlock }   from '../blocks/univers_diameter.js';
import { initUniversDistanceBlock }   from '../blocks/univers_distance.js';
import { initUniversLuminosityBlock } from '../blocks/univers_luminosity.js';
import { initUniversMassBlock }       from '../blocks/univers_mass.js';
import { initHistoryBlock }           from '../blocks/history.js';

// 2) обробники кнопки "Розрахувати" для режимів
import { onDiameterCalculate }   from '../events/diameter_buttons.js';
import { onDistanceCalculate }   from '../events/distance_buttons.js';
import { onLuminosityCalculate } from '../events/luminosity_buttons.js';
import { onMassCalculate }       from '../events/mass_buttons.js';
import { onHistoryCalculate }    from '../events/history_buttons.js';

// Реєстрація режимів: кожен опис має однакові ключі
registerMode('univers_diameter',   { initBlock: initUniversDiameterBlock,   onCalculate: onDiameterCalculate });
registerMode('univers_distance',   { initBlock: initUniversDistanceBlock,   onCalculate: onDistanceCalculate });
registerMode('univers_luminosity', { initBlock: initUniversLuminosityBlock, onCalculate: onLuminosityCalculate });
registerMode('univers_mass',       { initBlock: initUniversMassBlock,       onCalculate: onMassCalculate });
registerMode('history',            { initBlock: initHistoryBlock,           onCalculate: onHistoryCalculate });

import { initMoneyBlock } from '../blocks/money.js';
import { onMoneyCalculate } from '../events/money_buttons.js';
registerMode('money', { initBlock: initMoneyBlock, onCalculate: onMoneyCalculate });
