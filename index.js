'use strict';

var parse       = require('css').parse;
var toCamelCase = require('to-camel-case');
var recast      = require('recast');
var types       = recast.types;
var b           = types.builders;
var n           = recast.namedTypes;

var SPLIT_BY_PLACEHOLDER = /\$ReactStyle[0-9]+\$/;

function makePlaceholder(i) {
  return '$ReactStyle' + i + '$';
}

function transform(tree) {
  return recast.visit(tree, {
    visitTaggedTemplateExpression: function(path) {
      var node = path.value;
      if (node.tag.name === 'ReactStyle') {
        var template = node.quasi;
        var css = '';
        for (var i = 0, len = template.quasis.length; i < len; i++) {
          if (i !== 0) {
            css += makePlaceholder(i);
          }
          css += template.quasis[i].value.raw;
        }
        css = '.ReactStyle {' + css + '}';
        var declarations = parse(css).stylesheet.rules[0].declarations;
        var properties = declarations.map(function(decl) {
          var key = toCamelCase(decl.property);
          var value = decl.value.split(SPLIT_BY_PLACEHOLDER);
          if (value.length === 1) {
            value = b.literal(value[0]);
          } else {
            value = value.reduce(function(left, right, i) {
              if (typeof left === 'string') {
                if (left.length === 0) {
                  return template.expressions[i - 1];
                }
                left = b.literal(left);
              }
              var concat = b.binaryExpression('+', left, template.expressions[i - 1]);
              if (right.length === 0) {
                return concat;
              }
              return b.binaryExpression('+', concat, b.literal(right));
            });
          }
          return b.property('init', b.identifier(key), value);
        });
        path.replace(
          b.callExpression(b.identifier('ReactStyle'),
            [b.objectExpression(properties)])
        );
      }
      this.traverse(path);
    }
  });
}

function transformString(src) {
  if (this && this.cacheable) {
    this.cacheable();
  }
  if (!/ReactStyle[ ]*`/.exec(src)) {
    return src;
  }
  var tree = recast.parse(src);
  tree = transform(tree);
  src = recast.print(tree).code;
  return src;
}

module.exports = transformString;
module.exports.transformString = transformString;
module.exports.transform = transform;