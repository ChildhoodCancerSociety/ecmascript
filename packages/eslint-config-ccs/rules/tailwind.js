/* eslint-disable no-shadow */
/* eslint-disable func-names */
/* eslint-disable no-case-declarations */
/* eslint-disable prefer-destructuring */
// this rule is nice, and I don't really care about the others as much. just copying over
// https://github.com/francoismassart/eslint-plugin-tailwindcss/blob/master/lib/rules/classnames-order.js

/**
 * @fileoverview Use a consistent orders for the Tailwind CSS classnames,
 *               based on property then on variants
 * @author François Massart
 */

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

// Predefine message for use in context.report conditional.
// messageId will still be usable in tests.
const INVALID_CLASSNAMES_ORDER_MSG = "Invalid Tailwind CSS classnames order";

const contextFallbackCache = new WeakMap();

const fs = require("fs");
const path = require("path");
const resolveConfig = require("tailwindcss/resolveConfig");
const createContextFallback = require("tailwindcss/lib/lib/setupContextUtils").createContext;

function removeDuplicatesFromClassnamesAndWhitespaces(
  orderedClassNames,
  whitespaces,
  headSpace,
  tailSpace
) {
  let previous = orderedClassNames[0];
  const offset = (!headSpace && !tailSpace) || tailSpace ? -1 : 0;
  for (let i = 1; i < orderedClassNames.length; i++) {
    const cls = orderedClassNames[i];
    // This function assumes that the list of classNames is ordered
    // so just comparing to the previous className is enough
    if (cls === previous) {
      orderedClassNames.splice(i, 1);
      whitespaces.splice(i + offset, 1);
      i--;
    }
    previous = cls;
  }
}

function getOption(context, name) {
  // Options (defined at rule level)
  const options = context.options[0] || {};
  if (options[name] !== undefined) {
    return options[name];
  }
  // Settings (defined at plugin level, shared accross rules)
  if (
    context.settings
    && context.settings.tailwindcss
    && context.settings.tailwindcss[name] !== undefined
  ) {
    return context.settings.tailwindcss[name];
  }

  // Fallback to defaults
  switch (name) {
    case "callees":
      return ["classnames", "clsx", "ctl", "cva", "tv"];
    case "ignoredKeys":
      return ["compoundVariants", "defaultVariants"];
    case "classRegex":
      return "^class(Name)?$";
    case "config":
      return "tailwind.config.js";
    case "cssFiles":
      return ["**/*.css", "!**/node_modules", "!**/.*", "!**/dist", "!**/build"];
    case "cssFilesRefreshRate":
      return 5000;
    case "removeDuplicates":
      return true;
    case "skipClassAttribute":
      return false;
    case "tags":
      return [];
    case "whitelist":
      return [];
    default:
      return [];
  }
}

const CHECK_REFRESH_RATE = 1000;
let previousConfig = null;
let lastCheck = null;
let mergedConfig = null;
let lastModifiedDate = null;

/**
 * @see https://stackoverflow.com/questions/9210542/node-js-require-cache-possible-to-invalidate
 * @param {string} module The path to the module
 * @returns the module's export
 */
function requireUncached(module) {
  delete require.cache[require.resolve(module)];
  return require(module);
}

function loadConfig(config) {
  let loadedConfig = null;
  if (typeof config === "string") {
    const resolvedPath = path.isAbsolute(config) ? config : path.join(path.resolve(), config);
    try {
      const stats = fs.statSync(resolvedPath);
      if (stats === null) {
        loadedConfig = {};
      } else if (lastModifiedDate !== stats.mtime) {
        lastModifiedDate = stats.mtime;
        loadedConfig = requireUncached(resolvedPath);
      } else {
        loadedConfig = null;
      }
    } catch (err) {
      loadedConfig = {};
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      return loadedConfig;
    }
  } else {
    if (typeof config === "object" && config !== null) {
      return config;
    }
    return {};
  }
}

function convertConfigToString(config) {
  switch (typeof config) {
    case "string":
      return config;
    case "object":
      return JSON.stringify(config);
    default:
      return config.toString();
  }
}

function resolve(twConfig) {
  const now = new Date().getTime();
  const newConfig = convertConfigToString(twConfig) !== convertConfigToString(previousConfig);
  const expired = now - lastCheck > CHECK_REFRESH_RATE;
  if (newConfig || expired) {
    previousConfig = twConfig;
    lastCheck = now;
    const userConfig = loadConfig(twConfig);
    // userConfig is null when config file was not modified
    if (userConfig !== null) {
      mergedConfig = resolveConfig(userConfig);
    }
  }
  return mergedConfig;
}

const customConfig = {
  resolve
};

/** AST UTILS */

function removeDuplicatesFromArray(arr) {
  return [...new Set(arr)];
}

function calleeToString(calleeNode) {
  if (calleeNode.type === "Identifier") {
    return calleeNode.name;
  }
  if (calleeNode.type === "MemberExpression") {
    return `${calleeNode.object.name}.${calleeNode.property.name}`;
  }

  return null;
}

/**
 * Find out if node is `class` or `className`
 *
 * @param {ASTNode} node The AST node being checked
 * @param {String} classRegex Regex to test the attribute that is being checked against
 * @returns {Boolean}
 */
function isClassAttribute(node, classRegex) {
  if (!node.name) {
    return false;
  }
  let name = "";
  switch (node.type) {
    case "TextAttribute":
      name = node.name;
      break;
    default:
      name = node.name.name;
  }
  return new RegExp(classRegex).test(name);
}

/**
 * Find out if node is `class`
 *
 * @param {ASTNode} node The AST node being checked
 * @param {String} classRegex Regex to test the attribute that is being checked against
 * @returns {Boolean}
 */
function isVueClassAttribute(node, classRegex) {
  const re = new RegExp(classRegex);
  switch (true) {
    case node.key && node.key.name && re.test(node.key.name):
      // class="vue-classes-as-litteral"
      return true;
    case node.key
      && node.key.name
      && node.key.name.name
      && node.key.argument
      && node.key.argument.name
      && /^bind$/.test(node.key.name.name)
      && re.test(node.key.argument.name):
      // v-bind:class="vue-classes-as-bind"
      // :class="vue-classes-as-bind"
      return true;
    default:
      return false;
  }
}

/**
 * Find out if node's value attribute is just simple text
 *
 * @param {ASTNode} node The AST node being checked
 * @returns {Boolean}
 */
function isVLiteralValue(node) {
  return node.value && node.value.type === "VLiteral";
}

/**
 * Find out if node's value attribute is an ArrayExpression
 *
 * @param {ASTNode} node The AST node being checked
 * @returns {Boolean}
 */
function isArrayExpression(node) {
  return node.value && node.value.type === "VExpressionContainer" && node.value.expression.type === "ArrayExpression";
}

/**
 * Find out if node's value attribute is an ObjectExpression
 *
 * @param {ASTNode} node The AST node being checked
 * @returns {Boolean}
 */
function isObjectExpression(node) {
  return node.value && node.value.type === "VExpressionContainer" && node.value.expression.type === "ObjectExpression";
}

/**
 * Find out if node's value attribute is just simple text
 *
 * @param {ASTNode} node The AST node being checked
 * @returns {Boolean}
 */
function isVueValidAttributeValue(node) {
  switch (true) {
    case isVLiteralValue(node): // Simple string
    case isArrayExpression(node): // ['tw-unknown-class']
    case isObjectExpression(node): // {'tw-unknown-class': true}
      return true;
    default:
      return false;
  }
}

/**
 * Find out if node's value attribute is just simple text
 *
 * @param {ASTNode} node The AST node being checked
 * @returns {Boolean}
 */
function isLiteralAttributeValue(node) {
  if (node.type === "TextAttribute" && node.name === "class" && typeof node.value === "string") {
    return true;
  }
  if (node.value) {
    switch (node.value.type) {
      case "Literal":
        // No support for dynamic or conditional...
        return !/\{|\?|\}/.test(node.value.value);
      case "JSXExpressionContainer":
        // className={"..."}
        return node.value.expression.type === "Literal";
      default:
        break;
    }
  }
  return false;
}

/**
 * Find out if the node is a valid candidate for our rules
 *
 * @param {ASTNode} node The AST node being checked
 * @param {String} classRegex Regex to test the attribute that is being checked against
 * @returns {Boolean}
 */
function isValidJSXAttribute(node, classRegex) {
  if (!isClassAttribute(node, classRegex)) {
    // Only run for class[Name] attributes
    return false;
  }
  if (!isLiteralAttributeValue(node)) {
    // No support for dynamic or conditional classnames
    return false;
  }
  return true;
}

/**
 * Find out if the node is a valid candidate for our rules
 *
 * @param {ASTNode} node The AST node being checked
 * @param {String} classRegex Regex to test the attribute that is being checked against
 * @returns {Boolean}
 */
function isValidVueAttribute(node, classRegex) {
  if (!isVueClassAttribute(node, classRegex)) {
    // Only run for class attributes
    return false;
  }
  if (!isVueValidAttributeValue(node)) {
    // No support for dynamic or conditional classnames
    return false;
  }
  return true;
}

function extractRangeFromNode(node) {
  if (node.type === "TextAttribute" && node.name === "class") {
    return [node.valueSpan.fullStart.offset, node.valueSpan.end.offset];
  }
  switch (node.value.type) {
    case "JSXExpressionContainer":
      return node.value.expression.range;
    default:
      return node.value.range;
  }
}

function extractValueFromNode(node) {
  if (node.type === "TextAttribute" && node.name === "class") {
    return node.value;
  }
  switch (node.value.type) {
    case "JSXExpressionContainer":
      return node.value.expression.value;
    case "VExpressionContainer":
      switch (node.value.expression.type) {
        case "ArrayExpression":
          return node.value.expression.elements;
        case "ObjectExpression":
          return node.value.expression.properties;
        default:
          break;
      }
      return node.value.expression.value;
    default:
      return node.value.value;
  }
}

function extractClassnamesFromValue(classStr) {
  if (typeof classStr !== "string") {
    return { classNames: [], whitespaces: [], headSpace: false, tailSpace: false };
  }
  const separatorRegEx = /(\s+)/;
  const parts = classStr.split(separatorRegEx);
  if (parts[0] === "") {
    parts.shift();
  }
  if (parts[parts.length - 1] === "") {
    parts.pop();
  }
  const headSpace = separatorRegEx.test(parts[0]);
  const tailSpace = separatorRegEx.test(parts[parts.length - 1]);
  const isClass = (_, i) => (headSpace ? i % 2 !== 0 : i % 2 === 0);
  const isNotClass = (_, i) => (headSpace ? i % 2 === 0 : i % 2 !== 0);
  const classNames = parts.filter(isClass);
  const whitespaces = parts.filter(isNotClass);
  return { classNames, whitespaces, headSpace, tailSpace };
}

/**
 * Inspect and parse an abstract syntax node and run a callback function
 *
 * @param {ASTNode} rootNode The current root node being parsed by eslint
 * @param {ASTNode} childNode The AST node child argument being checked
 * @param {Function} cb The callback function
 * @param {Boolean} skipConditional Optional, indicate distinct parsing for conditional nodes
 * @param {Boolean?} isolate Set internally to isolate parsing and validation on conditional child+
 * @param {Array} ignoredKeys Optional, set object keys which should not be parsed e.g. for `cva`
 * @returns {void}
 */
function parseNodeRecursive(
  rootNode,
  childNode,
  cb,
  skipConditional = false,
  isolate = false,
  ignoredKeys = []
) {
  // TODO allow vue non litteral
  let originalClassNamesValue;
  let classNames;
  if (childNode === null) {
    originalClassNamesValue = extractValueFromNode(rootNode);
    ({ classNames } = extractClassnamesFromValue(originalClassNamesValue));
    classNames = removeDuplicatesFromArray(classNames);
    if (classNames.length === 0) {
      // Don't run for empty className
      return;
    }
    cb(classNames, rootNode);
  } else if (childNode === undefined) {
    // Ignore invalid child candidates (probably inside complex TemplateLiteral)

  } else {
    const forceIsolation = skipConditional ? true : isolate;
    switch (childNode.type) {
      case "TemplateLiteral":
        childNode.expressions.forEach((exp) => {
          parseNodeRecursive(rootNode, exp, cb, skipConditional, forceIsolation, ignoredKeys);
        });
        childNode.quasis.forEach((quasis) => {
          parseNodeRecursive(rootNode, quasis, cb, skipConditional, isolate, ignoredKeys);
        });
        return;
      case "ConditionalExpression":
        parseNodeRecursive(
          rootNode,
          childNode.consequent,
          cb,
          skipConditional,
          forceIsolation,
          ignoredKeys
        );
        parseNodeRecursive(
          rootNode,
          childNode.alternate,
          cb,
          skipConditional,
          forceIsolation,
          ignoredKeys
        );
        return;
      case "LogicalExpression":
        parseNodeRecursive(
          rootNode,
          childNode.right,
          cb,
          skipConditional,
          forceIsolation,
          ignoredKeys
        );
        return;
      case "ArrayExpression":
        childNode.elements.forEach((el) => {
          parseNodeRecursive(rootNode, el, cb, skipConditional, forceIsolation, ignoredKeys);
        });
        return;
      case "ObjectExpression":
        childNode.properties.forEach((prop) => {
          const isUsedByClassNamesPlugin = rootNode.callee && rootNode.callee.name === "classnames";

          if (prop.key.type === "Identifier" && ignoredKeys.includes(prop.key.name)) {
            // Ignore specific keys defined in settings
            return;
          }

          parseNodeRecursive(
            rootNode,
            isUsedByClassNamesPlugin ? prop.key : prop.value,
            cb,
            skipConditional,
            forceIsolation,
            ignoredKeys
          );
        });
        return;
      case "Property":
        parseNodeRecursive(
          rootNode,
          childNode.key,
          cb,
          skipConditional,
          forceIsolation,
          ignoredKeys
        );
        return;
      case "Literal":
        originalClassNamesValue = childNode.value;
        break;
      case "TemplateElement":
        originalClassNamesValue = childNode.value.raw;
        break;
      default:
        break;
    }
    ({ classNames } = extractClassnamesFromValue(originalClassNamesValue));
    classNames = removeDuplicatesFromArray(classNames);
    if (classNames.length === 0) {
      // Don't run for empty className
      return;
    }
    const targetNode = isolate ? null : rootNode;
    cb(classNames, targetNode);
  }
}

function getTemplateElementPrefix(text, raw) {
  const idx = text.indexOf(raw);
  if (idx === 0) {
    return "";
  }
  return text.split(raw).shift();
}

function getTemplateElementSuffix(text, raw) {
  if (text.indexOf(raw) === -1) {
    return "";
  }
  return text.split(raw).pop();
}

function getTemplateElementBody(text, prefix, suffix) {
  let arr = text.split(prefix);
  arr.shift();
  const body = arr.join(prefix);
  arr = body.split(suffix);
  arr.pop();
  return arr.join(suffix);
}

const astUtil = {
  isValidJSXAttribute,
  isValidVueAttribute,
  extractRangeFromNode,
  calleeToString,
  getTemplateElementPrefix,
  getTemplateElementSuffix,
  getTemplateElementBody,
  parseNodeRecursive
};

/** ORDER */

function bigSign(bigIntValue) {
  return (bigIntValue > BigInt(0)) - (bigIntValue < BigInt(0));
}

function prefixCandidate(context, selector) {
  const prefix = context.tailwindConfig.prefix;
  return typeof prefix === "function" ? prefix(selector) : prefix + selector;
}

// Polyfill for older Tailwind CSS versions
function getClassOrderPolyfill(classes, { env }) {
  // A list of utilities that are used by certain Tailwind CSS utilities but
  // that don't exist on their own. This will result in them "not existing" and
  // sorting could be weird since you still require them in order to make the
  // host utitlies work properly. (Thanks Biology)
  const parasiteUtilities = new Set([prefixCandidate(env.context, "group"), prefixCandidate(env.context, "peer")]);

  const classNamesWithOrder = [];

  for (const className of classes) {
    const init = env.generateRules(
      new Set([className]),
      env.context
    ).sort(([a], [z]) => bigSign(z - a));

    let order = init[0] ? (init[0][0] || null) : null;

    if (order === null && parasiteUtilities.has(className)) {
      // This will make sure that it is at the very beginning of the
      // `components` layer which technically means 'before any
      // components'.
      order = env.context.layerOrder.components;
    }

    classNamesWithOrder.push([className, order]);
  }

  return classNamesWithOrder;
}

function sortClasses(classStr, { env, ignoreFirst = false, ignoreLast = false }) {
  if (typeof classStr !== "string" || classStr === "") {
    return classStr;
  }

  // Ignore class attributes containing `{{`, to match Prettier behaviour:
  // https://github.com/prettier/prettier/blob/main/src/language-html/embed.js#L83-L88
  if (classStr.includes("{{")) {
    return classStr;
  }

  let result = "";
  const parts = classStr.split(/(\s+)/);
  let classes = parts.filter((_, i) => i % 2 === 0);
  const whitespace = parts.filter((_, i) => i % 2 !== 0);

  if (classes[classes.length - 1] === "") {
    classes.pop();
  }

  let prefix = "";
  if (ignoreFirst) {
    prefix = `${classes.shift() || ""}${whitespace.shift() || ""}`;
  }

  let suffix = "";
  if (ignoreLast) {
    suffix = `${whitespace.pop() || ""}${classes.pop() || ""}`;
  }

  const classNamesWithOrder = env.context.getClassOrder
    ? env.context.getClassOrder(classes)
    : getClassOrderPolyfill(classes, { env });

  classes = classNamesWithOrder
    .sort(([, a], [, z]) => {
      if (a === z) return 0;
      // if (a === null) return options.unknownClassPosition === 'start' ? -1 : 1
      // if (z === null) return options.unknownClassPosition === 'start' ? 1 : -1
      if (a === null) return -1;
      if (z === null) return 1;
      return bigSign(a - z);
    })
    .map(([className]) => className);

  for (let i = 0; i < classes.length; i++) {
    result += `${classes[i]}${whitespace[i] || ""}`;
  }

  return prefix + result + suffix;
}

/** PARSER UTIL */

function defineTemplateBodyVisitor(context, templateBodyVisitor, scriptVisitor) {
  if (context.parserServices == null || context.parserServices.defineTemplateBodyVisitor == null) {
    // Default parser
    return scriptVisitor;
  }

  // Using "vue-eslint-parser" requires this setup
  // @see https://eslint.org/docs/developer-guide/working-with-rules#the-context-object
  return context.parserServices.defineTemplateBodyVisitor(templateBodyVisitor, scriptVisitor);
}

const parserUtil = {
  defineTemplateBodyVisitor
};

/**
 *
 * @param {Array} unordered the unordered classnames
 * @param  context
 * @returns {Array} the ordered classnames
 */
function order(unordered, context) {
  const sorted = sortClasses(unordered.join(" "), { env: { context } });
  return sorted;
}

module.exports = {
  meta: {
    docs: {
      description: "Enforce a consistent and logical order of the Tailwind CSS classnames",
      category: "Stylistic Issues",
      recommended: false,
      url: "https://github.com/francoismassart/eslint-plugin-tailwindcss/tree/master/docs/rules/classnames-order.md",
    },
    messages: {
      invalidOrder: INVALID_CLASSNAMES_ORDER_MSG,
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          callees: {
            type: "array",
            items: { type: "string", minLength: 0 },
            uniqueItems: true,
          },
          ignoredKeys: {
            type: "array",
            items: { type: "string", minLength: 0 },
            uniqueItems: true,
          },
          config: {
            // default: 'tailwind.config.js',
            type: ["string", "object"],
          },
          removeDuplicates: {
            // default: true,
            type: "boolean",
          },
          tags: {
            type: "array",
            items: { type: "string", minLength: 0 },
            uniqueItems: true,
          },
        },
      },
    ],
  },

  create(context) {
    const callees = getOption(context, "callees");
    const skipClassAttribute = getOption(context, "skipClassAttribute");
    const tags = getOption(context, "tags");
    const twConfig = getOption(context, "config");
    const classRegex = getOption(context, "classRegex");
    const removeDuplicates = getOption(context, "removeDuplicates");

    // eslint-disable-next-line no-shadow
    const mergedConfig = customConfig.resolve(twConfig);
    // Set the created contextFallback in the cache if it does not exist yet.
    const contextFallback = (
      contextFallbackCache.has(mergedConfig)
        ? contextFallbackCache
        : contextFallbackCache.set(mergedConfig, createContextFallback(mergedConfig))
    ).get(mergedConfig);

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------
    /**
     * Recursive function crawling into child nodes
     * @param {ASTNode} node The root node of the current parsing
     * @param {ASTNode} arg The child node of node
     * @returns {void}
     */
    const sortNodeArgumentValue = (node, arg = null) => {
      let originalClassNamesValue = null;
      let start = null;
      let end = null;
      let prefix = "";
      let suffix = "";
      if (arg === null) {
        originalClassNamesValue = astUtil.extractValueFromNode(node);
        const range = astUtil.extractRangeFromNode(node);
        if (node.type === "TextAttribute") {
          start = range[0];
          end = range[1];
        } else {
          start = range[0] + 1;
          end = range[1] - 1;
        }
      } else {
        switch (arg.type) {
          case "Identifier":
            return;
          case "TemplateLiteral":
            arg.expressions.forEach((exp) => {
              sortNodeArgumentValue(node, exp);
            });
            arg.quasis.forEach((quasis) => {
              sortNodeArgumentValue(node, quasis);
            });
            return;
          case "ConditionalExpression":
            sortNodeArgumentValue(node, arg.consequent);
            sortNodeArgumentValue(node, arg.alternate);
            return;
          case "LogicalExpression":
            sortNodeArgumentValue(node, arg.right);
            return;
          case "ArrayExpression":
            arg.elements.forEach((el) => {
              sortNodeArgumentValue(node, el);
            });
            return;
          case "ObjectExpression":
            // eslint-disable-next-line no-case-declarations
            const isUsedByClassNamesPlugin = node.callee && node.callee.name === "classnames";
            // eslint-disable-next-line no-case-declarations
            const isVue = node.key && node.key.type === "VDirectiveKey";
            arg.properties.forEach((prop) => {
              const propVal = isUsedByClassNamesPlugin || isVue ? prop.key : prop.value;
              sortNodeArgumentValue(node, propVal);
            });
            return;
          case "Property":
            sortNodeArgumentValue(node, arg.key);
            break;
          case "Literal":
            originalClassNamesValue = arg.value;
            start = arg.range[0] + 1;
            end = arg.range[1] - 1;
            break;
          case "TemplateElement":
            originalClassNamesValue = arg.value.raw;
            if (originalClassNamesValue === "") {
              return;
            }
            start = arg.range[0];
            end = arg.range[1];
            // https://github.com/eslint/eslint/issues/13360
            // The problem is that range computation includes the backticks (`test`)
            // but value.raw does not include them, so there is a mismatch.
            // start/end does not include the backticks, therefore it matches value.raw.
            const txt = context.getSourceCode().getText(arg);
            prefix = astUtil.getTemplateElementPrefix(txt, originalClassNamesValue);
            suffix = astUtil.getTemplateElementSuffix(txt, originalClassNamesValue);
            originalClassNamesValue = astUtil.getTemplateElementBody(txt, prefix, suffix);
            break;
          default:
            break;
        }
      }

      const {
        classNames,
        whitespaces,
        headSpace,
        tailSpace
      } = astUtil.extractClassnamesFromValue(originalClassNamesValue);

      if (classNames.length <= 1) {
        // Don't run sorting for a single or empty className
        return;
      }

      const orderedClassNames = order(classNames, contextFallback).split(" ");

      if (removeDuplicates) {
        removeDuplicatesFromClassnamesAndWhitespaces(
          orderedClassNames,
          whitespaces,
          headSpace,
          tailSpace,
        );
      }

      // Generates the validated/sorted attribute value
      let validatedClassNamesValue = "";
      for (let i = 0; i < orderedClassNames.length; i++) {
        const w = whitespaces[i] || "";
        const cls = orderedClassNames[i];
        validatedClassNamesValue += headSpace ? `${w}${cls}` : `${cls}${w}`;
        if (headSpace && tailSpace && i === orderedClassNames.length - 1) {
          validatedClassNamesValue += whitespaces[whitespaces.length - 1] || "";
        }
      }

      if (originalClassNamesValue !== validatedClassNamesValue) {
        validatedClassNamesValue = prefix + validatedClassNamesValue + suffix;
        context.report({
          node,
          messageId: "invalidOrder",
          fix(fixer) {
            return fixer.replaceTextRange([start, end], validatedClassNamesValue);
          },
        });
      }
    };

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    const attributeVisitor = function (node) {
      if (!astUtil.isClassAttribute(node, classRegex) || skipClassAttribute) {
        return;
      }
      if (astUtil.isLiteralAttributeValue(node)) {
        sortNodeArgumentValue(node);
      } else if (node.value && node.value.type === "JSXExpressionContainer") {
        sortNodeArgumentValue(node, node.value.expression);
      }
    };

    const callExpressionVisitor = function (node) {
      const calleeStr = astUtil.calleeToString(node.callee);
      if (callees.findIndex((name) => calleeStr === name) === -1) {
        return;
      }

      node.arguments.forEach((arg) => {
        sortNodeArgumentValue(node, arg);
      });
    };

    const scriptVisitor = {
      JSXAttribute: attributeVisitor,
      TextAttribute: attributeVisitor,
      CallExpression: callExpressionVisitor,
      TaggedTemplateExpression(node) {
        if (!tags.includes(node.tag.name)) {
          return;
        }

        sortNodeArgumentValue(node, node.quasi);
      },
    };
    const templateVisitor = {
      CallExpression: callExpressionVisitor,
      /*
      Tagged templates inside data bindings
      https://github.com/vuejs/vue/issues/9721
      */
      VAttribute(node) {
        switch (true) {
          case !astUtil.isValidVueAttribute(node, classRegex):
            return;
          case astUtil.isVLiteralValue(node):
            sortNodeArgumentValue(node, null);
            break;
          case astUtil.isArrayExpression(node):
            node.value.expression.elements.forEach((arg) => {
              sortNodeArgumentValue(node, arg);
            });
            break;
          case astUtil.isObjectExpression(node):
            node.value.expression.properties.forEach((prop) => {
              sortNodeArgumentValue(node, prop);
            });
            break;
          default:
            break;
        }
      },
    };

    return parserUtil.defineTemplateBodyVisitor(context, templateVisitor, scriptVisitor);
  },
};
