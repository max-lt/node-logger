/**
 * @typedef {object}    Rogger
 * @typedef {function}  Rogger.verbose
 * @typedef {function}  Rogger.debug
 * @typedef {function}  Rogger.log: alias for debug
 * @typedef {function}  Rogger.info
 * @typedef {function}  Rogger.warn
 * @typedef {function}  Rogger.error
 * @typedef {string}    Rogger.level
 * @typedef {function}  Rogger.getLevel
 * @typedef {function(string)} Rogger.setLevel
 * @typedef {function}  Rogger.getDefaultLevel
 * @typedef {function(string)} Rogger.setDefaultLevel
 * @typedef {function}  Rogger.getAvailableLevels
 * @typedef {function}  Rogger.getLoggers
 */

/**
 * @typedef {function(initLevel:string=):Rogger} BuildRogger
 */

/**
 * @typedef {{
 *  log:function,
 *  verbose:?function,
 *  debug?:function,
 *  info:?function,
 *  warn:?function,
 *  error:?function}} OutputMedium
 */

//////////////////////////////////////////////////////
//    Internal module's variables & functions
//////////////////////////////////////////////////////
const APP_ROOT = require.main.filename.split('/').slice(0, -1).join('/');

const levelDefinitions = [
    {level: 'verbose', color: 'magenta'},
    {level: 'debug', color: 'blue'},
    {level: 'info', color: 'green'},
    {level: 'warn', color: 'yellow'},
    {level: 'error', color: 'red'}
];

const colorList = levelDefinitions.map((d) => d.color);
const levelList = levelDefinitions.map((d) => d.level);

let colors;
try {
    //noinspection NpmUsedModulesInstalled
    colors = require('cli-color');
} catch (err) {
    const c = {};
    colorList.forEach((color) => c[color] = _ => _);
    colors = c;
    colors.bold = c;
}

const loggersMap = new Map();

const ceil = (v) => v < 1 ? 0 : v;

// level to index
const ltoi = (a) => ceil(levelList.indexOf(a));

// index to level
const itol = (i) => levelList[i];

let globalLevelIndex = 0;

//////////////////////////////////////////////////////
//    Exported functions for both instances & module
//////////////////////////////////////////////////////

const defaultLevelGetterSetter = {
    set: (level) => {
        globalLevelIndex = ltoi(level)
    },
    get: () => itol(globalLevelIndex)
};

const getAvailableLevels = () => levelList;

const getDefaultLevel = () => itol(globalLevelIndex);

const setDefaultLevel = (level) => globalLevelIndex = ltoi(level);

const getLoggers = () => loggersMap;

//////////////////////////////////////////////////////
//    Logger pre-factory
//////////////////////////////////////////////////////
/**
 * @param {Console | OutputMedium | function} outputMedium
 * @return BuildRogger
 */
function preBuildLogger(outputMedium) {

    function Rogger({origin: o, level: initLevel}) {

        const module = o && o.main || 'unknown origin';

        let loggerLevelIndex = initLevel ? ltoi(initLevel) : globalLevelIndex;

        Object.defineProperty(this, 'level', {
            set: (level) => {
                loggerLevelIndex = ltoi(level);
                return this;
            },
            get: () => {
                return itol(loggerLevelIndex);
            }
        });

        levelDefinitions.forEach((elt, i) => {
            this[elt.level] = function () {
                if (i >= loggerLevelIndex) {
                    (outputMedium[elt] || outputMedium.log || outputMedium)
                        .apply(this, [].concat(
                            `${(new Date).toISOString().slice(0, -5)}`,
                            colors.bold[elt.color](`[${elt.level.charAt(0).toUpperCase()}]`),
                            colors[elt.color](`${module}\t`),
                            Array.from(arguments)
                        ))
                }
            }
        });

        this.setLevel = (level) => this.level = level;

        this.getLevel = () => this.level;

        this.log = this.debug;

        this.verbose(`Built logger from ${module} ` + ((o && o.char && o.line) ? `(${o.line},${o.char})` : ''));

        loggersMap.set(module, this);

    }

    Rogger.prototype.getAvailableLevels = getAvailableLevels;
    Rogger.prototype.getDefaultLevel = getDefaultLevel;
    Rogger.prototype.setDefaultLevel = setDefaultLevel;
    Rogger.prototype.getLoggers = getLoggers;

    Object.defineProperty(Rogger.prototype, 'defaultLevel', defaultLevelGetterSetter);

    return Rogger;

}

//////////////////////////////////////////////////////
//    Logger factory
//////////////////////////////////////////////////////
/**
 * @param opts
 * @returns Rogger
 */
function roggerFactory(opts) {

    const level = opts && opts.level;
    const callee = opts && opts.callee || arguments.callee;
    const output = opts && opts.output || console;

    const obj = {};
    const oldStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack) => stack;
    //noinspection JSUnresolvedFunction
    Error.captureStackTrace(obj, callee);
    const prevCall = obj.stack[0].toString();
    Error.prepareStackTrace = oldStackTrace;

    const reg = new RegExp(`^.*\\(${APP_ROOT}((.*)\.js):(.*):(.*)\\)$`, 'i');
    const match = reg.exec(prevCall) || ['', '', ''];
    const file = match[2].split('/');
    const module = file.slice(-1)[0] === 'index' ? file.slice(-3, -1).join('/') + '/' : file.slice(-2).join('/');

    const origin = {
        root: APP_ROOT,
        file: match[1],
        main: module,
        line: match[3],
        char: match[4]
    };

    return new (preBuildLogger(output))({origin, level})

}

module.exports = roggerFactory;
module.exports.getAvailableLevels = getAvailableLevels;
module.exports.getDefaultLevel = getDefaultLevel;
module.exports.setDefaultLevel = setDefaultLevel;
module.exports.getLoggers = getLoggers;