import { CLASS_SKILLS } from "./classSkills.js";
const learned = id => ({ kind: "class", id });
const mastery = (id, amount) => ({ kind: "mastery", id, amount });
const training = id => ({ kind: "unlock", id, label: `${id.replaceAll("-", " ")} training / world unlock` });
const any = (...conditions) => ({ any: conditions });
const martial = any(mastery("sword", 3), mastery("axe", 3), mastery("greatsword", 3), mastery("unarmed", 3));
const define = (id, name, category, description, weaponAffinities, skillIds, unlockRequirements = []) => Object.freeze({
    id, name, category, description, weaponAffinities, skillIds,
    passiveIds: skillIds.filter(id => CLASS_SKILLS[id].type === "passive"), unlockRequirements
});
export const CLASS_DEFINITIONS = Object.freeze(Object.fromEntries([
    define("infantry", "Infantry", "melee", "Weapon fundamentals, survivability and counters.", ["sword", "greatsword", "axe", "spear"], ["sword-mastery", "twin-strike", "smash", "counter-stance", "combat-training"]),
    define("warrior", "Warrior", "melee", "Aggressive heavy attacks, low-HP pressure and Bleed exploitation.", ["greatsword", "axe"], ["heavy-blow", "blood-rush", "cleave", "execution", "battle-hardened"], [learned("infantry"), martial]),
    define("knight", "Knight", "melee", "Protect allies, intercept attacks and counter from defense.", ["sword", "spear", "shield"], ["guard-ally", "shield-bash", "defensive-stance", "hold-the-line", "armor-training"], [learned("infantry"), martial, training("knight")]),
    define("crusader", "Crusader", "melee", "Faith-based martial protection, purification and sacrifice.", ["sword", "shield"], ["consecrated-strike", "ward-of-faith", "purge", "martyr", "last-prayer"], [learned("knight"), training("faith")]),
    define("archer", "Archer", "ranged", "Reliable bow fundamentals, aiming and multishot.", ["bow"], ["aimed-shot", "quick-shot", "pinning-shot", "archer-bow-mastery", "eagle-eye"]),
    define("hunter", "Hunter", "ranged", "Mark prey, set traps and exploit conditions and monster knowledge.", ["bow"], ["hunters-mark", "leg-shot", "trap", "exploit-weakness", "beast-knowledge"], [learned("archer"), mastery("bow", 3), training("wilderness")]),
    define("mercenary", "Mercenary", "ranged", "Professional crossbow and early-firearm soldier: reload, ammunition and heavy single shots.", ["crossbow", "firearm"], ["crossbow-shot", "arquebus-shot", "quick-reload", "armor-breaker", "point-blank-shot", "special-ammunition", "professional-soldier"], [any(mastery("crossbow", 1), mastery("firearm", 1)), training("professional-soldier")]),
    define("bow-master", "Bow Master", "ranged", "Pure bow precision, critical multishot and expert armor penetration.", ["bow"], ["power-shot", "triple-shot", "perfect-aim", "piercing-arrow", "expert-bow-mastery"], [learned("archer"), mastery("bow", 15)]),
    define("magician", "Magician", "magic", "Formal spells, elemental study and AP efficiency.", ["staff"], ["magic-bolt", "elemental-study", "focus", "mana-control", "arcane-knowledge"]),
    define("wizard", "Wizard", "magic", "Prepare, amplify, repeat and convert formal spells.", ["staff"], ["amplify", "chain-spell", "element-conversion", "arcane-break", "prepared-spell"], [learned("magician"), mastery("structuredMagic", 5), training("advanced-magic")]),
    define("cleric", "Cleric", "magic", "Healing, wards, purification and anti-supernatural support.", ["staff", "shield"], ["mend", "blessing", "cleanse", "sanctuary", "exorcism"], [training("faith")])
].map(definition => [definition.id, definition])));
