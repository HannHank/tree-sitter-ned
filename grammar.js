module.exports = grammar({
  name: "ned",

  word: ($) => $._NAME, // Increases performance, see https://tree-sitter.github.io/tree-sitter/creating-parsers/3-writing-the-grammar.html#keyword-extraction

  extras: ($) => [/\s/, $.inline_comment],

  conflicts: ($) => [[$._dottedname, $._modulepart]],

  rules: {
    nedfile: ($) =>
      prec.right(
        repeat1(
          choice(
            $.comment,
            $._EMPTYLINE,
            $.package,
            $.import,
            $.property_decl,
            field(
              "property",
              alias(seq($._property_namevalue, ";"), $.property),
            ),
            $.channel,
            $.channel_interface,
            $.simple,
            $.module,
            $.network,
            $.moduleinterface,
            ";",
          ),
        ),
      ),

    comment: ($) => prec.right(repeat1($._commentline)),

    _commentline: ($) => token(seq("//", /(\\+(.|\r?\n)|[^\\\n])*/)),

    inline_comment: ($) => $._commentline,

    package: ($) =>
      seq("package", field("name", alias($._dottedname, $.name)), ";"),

    _dottedname: ($) => prec.right(seq($._NAME, repeat(seq(".", $._NAME)))),

    import: ($) =>
      seq("import", field("name", alias($.importspec, $.name)), ";"),

    importspec: ($) =>
      choice(
        $._import_un_qname,
        seq(repeat(seq($._importname, ".")), $._import_un_qname),
      ),

    _import_un_qname: ($) => $._importname,

    _importname: ($) => repeat1(choice($._NAME, "*", "**")),

    property: ($) => $._property_namevalue,

    property_decl: ($) =>
      choice(
        seq($.property_decl_header, optional($.inline_properties), ";"),
        seq(
          $.property_decl_header,
          "(",
          optional($.property_decl_keys),
          ")",
          optional($.inline_properties),
          ";",
        ),
      ),

    property_decl_header: ($) =>
      choice(
        seq("property", "@", $._NAME, "[", "]"),
        seq("property", "@", $._NAME),
      ),

    property_decl_keys: ($) =>
      seq($.property_decl_key, repeat(seq(";", $.property_decl_key))),

    property_decl_key: ($) => $._property_literal,

    fileproperty: ($) => seq($._property_namevalue, ";"),

    channel: ($) => seq($._channelheader, "{", optional($.parameters), "}"),

    _channelheader: ($) =>
      seq(
        "channel",
        field("name", alias($._NAME, $.name)),
        optional($._inheritance),
      ),

    _inheritance: ($) =>
      choice(
        "extends",
        seq("like", $._likenames),
        seq("extends", $.extends),
        seq("extends", $.extends, "like", $._likenames),
      ),

    extends: ($) => field("extends", $._dottedname),

    _likenames: ($) => seq($._likename, repeat(seq(",", $._likename))),

    _likename: ($) => field("implements", alias($._dottedname, $.implements)),

    channel_interface: ($) =>
      seq($.channelinterfaceheader, "{", optional($.parameters), "}"),

    channelinterfaceheader: ($) =>
      seq("channelinterface", $._NAME, optional($._interfaceinheritance)),

    _interfaceinheritance: ($) => seq("extends", $._extendnames),

    _extendnames: ($) => seq($.extends, repeat(seq(",", $.extends))),

    simple: ($) =>
      prec.right(
        seq(
          $._simplemoduleheader,
          "{",
          repeat(choice($.parameters, $.gates, $.types, $.submodules, $.connections)), // INFO: Normally just parameters and gates allowed
          "}",
        ),
      ),

    _simplemoduleheader: ($) =>
      seq(
        "simple",
        field("name", alias($._NAME, $.name)),
        optional($._inheritance),
      ),

    module: ($) =>
      prec.right(
        seq(
          $._compoundmoduleheader,
          "{",
          repeat(
            choice($.parameters, $.gates, $.types, $.submodules, $.connections),
          ),
          "}",
        ),
      ),

    _compoundmoduleheader: ($) =>
      prec.right(
        seq(
          "module",
          field("name", alias($._NAME, $.name)),
          optional($._inheritance),
        ),
      ),

    network: ($) =>
      seq(
        $._networkheader,
        "{",
        optional($.parameters),
        optional($.gates),
        optional($.types),
        optional($.submodules),
        optional($.connections),
        "}",
      ),

    _networkheader: ($) =>
      seq(
        "network",
        field("name", alias($._NAME, $.name)),
        optional($._inheritance),
      ),

    moduleinterface: ($) =>
      seq(
        $._moduleinterfaceheader,
        "{",
        optional($.parameters),
        optional($.gates),
        "}",
      ),

    _moduleinterfaceheader: ($) =>
      seq(
        "moduleinterface",
        field("name", alias($._NAME, $.name)),
        optional($._interfaceinheritance),
      ),

    parameters: ($) =>
      prec.right(
        choice(
          $._params,
          seq("parameters", ":", $._params),
          seq("parameters", ":"),
        ),
      ),

    _params: ($) => prec.right(repeat1($._paramsitem)),

    _paramsitem: ($) =>
      prec.right(
        10,
        seq(choice($.parameter, $.property), ";", optional($.comment)),
      ),

    parameter: ($) => choice($._param_typenamevalue, $._parampattern_value),

    _param_typenamevalue: ($) =>
      choice(
        seq($._param_typename, optional($.inline_properties)),
        seq(
          $._param_typename,
          optional($.inline_properties),
          "=",
          field("value", field("value", alias($.paramvalue, $.value))),
          optional($.inline_properties),
        ),
      ),

    _param_typename: ($) =>
      choice(
        seq(
          optional("volatile"),
          field("type", alias($.paramtype, $.type)),
          field("parameter_signature", field("name", alias($._NAME, $.name))),
        ),
        field("parameter_signature", field("name", alias($._NAME, $.name))),
      ),

    _parampattern_value: ($) =>
      seq(
        $._parampattern,
        optional($.inline_properties),
        "=",
        field("value", alias($.paramvalue, $.value)),
      ),

    paramtype: ($) =>
      choice("double", "int", "string", "bool", "object", "xml"),

    paramvalue: ($) =>
      prec.right(
        choice(
          $._expression,
          seq("default", "(", $._expression, ")"),
          "default",
          "ask",
        ),
      ),

    inline_properties: ($) => repeat1($._inline_property_namevalue),

    _parampattern: ($) => field("parameter_signature", $.pattern),

    pattern: ($) =>
      seq(
        prec.right(seq($._pattern_elem, repeat(seq(".", $._pattern_elem)))),
        ".",
        choice($._pattern_elem, "typename"),
      ),

    _pattern_elem: ($) =>
      choice(
        seq($._pattern_name, "[", $.pattern_index, "]"),
        seq($._pattern_name, "[", "*", "]"),
        "**",
        $._pattern_name,
      ),

    _pattern_name: ($) =>
      prec.right(
        10,
        repeat1(
          choice(
            $._NAME,
            seq($._NAME, "$", $._NAME),
            "channel",
            seq("{", $.pattern_index, "}"),
            "*",
          ),
        ),
      ),

    pattern_index: ($) =>
      choice(
        $._INTCONSTANT,
        seq($._INTCONSTANT, "..", $._INTCONSTANT),
        seq("..", $._INTCONSTANT),
        seq($._INTCONSTANT, ".."),
      ),

    _property_namevalue: ($) =>
      choice(
        field("property_signature", $._property_name),
        prec.right(
          seq(
            field("property_signature", $._property_name),
            "(",
            optional($._property_tags),
            ")",
          ),
        ),
      ),

    _inline_property_namevalue: ($) =>
      choice(
        $._property_name,
        prec.right(seq($._property_name, "(", optional($._property_tags), ")")),
      ),

    _property_name: ($) =>
      prec.right(
        choice(
          seq("@", field("name", alias($._PROPNAME, $.name))),
          seq(
            "@",
            field("name", alias($._PROPNAME, $.name)),
            "[",
            field("index", alias($._PROPINDEX, $.index)),
            "]",
          ),
        ),
      ),

    _property_tags: ($) =>
      seq(
        field("tag", alias($.property_tag, $.tag)),
        repeat(seq(";", field("tag", alias($.property_tag, $.tag)))),
        optional(";"),
      ),

    property_tag: ($) =>
      prec.right(
        choice(
          seq(
            field("name", alias($._property_literal, $.name)),
            "=",
            field(
              "value_list",
              alias(optional($._property_value), $.value_list),
            ),
          ),
          field("value_list", alias($.property_values, $.value_list)),
        ),
      ),

    property_values: ($) =>
      prec.right(seq($._property_value, repeat(seq(",", $._property_value)))),

    _property_value: ($) => $._property_literal,

    _property_literal: ($) =>
      repeat1(
        seq(
          choice(
            $._COMMONCHAR,
            $._STRINGCONSTANT,
            $._XMLCONSTANT,
            seq("(", $._property_literal, ")"),
          ),
        ),
      ),

    gates: ($) => prec.right(seq("gates", ":", repeat($.gate))),

    gate: ($) =>
      seq(
        $._gate_typenamesize,
        optional($.inline_properties),
        ";",
        optional($.comment),
      ),

    _gate_typenamesize: ($) =>
      choice(
        seq($._gatetype, field("name", alias($._NAME, $.name))),
        seq(
          $._gatetype,
          field("name", alias($._NAME, $.name)),
          field("vector", alias("[]", $.vector)),
        ),
        seq(
          $._gatetype,
          field("name", alias($._NAME, $.name)),
          field("vector", alias($.sizevector, $.vector)),
        ),
        field("name", alias($._NAME, $.name)),
        seq(field("name", alias($._NAME, $.name)), "[", "]"),
        seq(
          field("name", alias($._NAME, $.name)),
          field("vector", alias($.sizevector, $.vector)),
        ),
      ),

    _gatetype: ($) =>
      field(
        "type",
        field("input", alias(choice("input", "output", "inout"), $.type)),
      ),

    types: ($) => prec.right(seq("types", ":", repeat($._localtypes))),

    _localtypes: ($) => prec.right(repeat1($._localtype)),

    _localtype: ($) =>
      choice(
        $.property_decl,
        $.channel,
        $.channel_interface,
        $.simple,
        $.module,
        $.network,
        $.moduleinterface,
        ";",
      ),

    submodules: ($) =>
      prec.right(
        seq(
          "submodules",
          ":",
          prec.right(repeat(choice($.submodule, $.comment))),
        ),
      ),

    submodule: ($) =>
      prec.right(
        choice(
          seq($._submoduleheader, ";"),
          seq(
            $._submoduleheader,
            "{",
            optional(optional($.parameters)),
            optional(optional($.gates)),
            "}",
            optional(";"),
          ),
        ),
      ),

    _submoduleheader: ($) =>
      prec.right(
        choice(
          seq(
            $._submodulename,
            ":",
            field("type", alias($._dottedname, $.type)),
            optional($.condition),
          ),
          seq(
            $._submodulename,
            ":",
            field("like_expr", alias($.likeexpr, $.like_expr)),
            "like",
            field("like_type", alias($._dottedname, $.like_type)),
            optional($.condition),
          ),
        ),
      ),

    _submodulename: ($) =>
      prec.right(
        choice(
          field("name", alias($._NAME, $.name)),
          seq(
            field("name", alias($._NAME, $.name)),
            field("vector", alias($.sizevector, $.vector)),
          ),
        ),
      ),

    likeexpr: ($) =>
      choice(
        seq("<", ">"),
        seq("<", $._expression, ">"),
        seq("<", "default", "(", $._expression, ")", ">"),
      ),

    connections: ($) =>
      prec.right(
        seq(
          "connections",
          field(
            "allowunconnected",
            alias(optional("allowunconnected"), $.allowunconnected),
          ),
          ":",
          repeat(
            choice(
              $.connection,
              $._loop_or_condition,
              field("connection_group", alias($.ifblock, $.connection_group)),
              field("connection_group", alias($.forblock, $.connection_group)),
              $.comment,
            ),
          ),
        ),
      ),

    connection: ($) =>
      prec.right(
        choice(
          seq(
            field("src", alias($.connectionname, $.src)),
            $.arrow,
            field("dest", alias($.connectionname, $.dest)),
            optional($._loops_and_conditions),
            ";",
          ),
          seq(
            field("src", alias($.connectionname, $.src)),
            $.arrow,
            $._channelspec,
            $.arrow,
            field("dest", alias($.connectionname, $.dest)),
            optional($._loops_and_conditions),
            ";",
          ),
        ),
      ),

    arrow: ($) => choice("-->", "<--", "<-->"),

    connectionname: ($) => $._modulegate,

    _modulegate: ($) =>
      prec.left(
        seq(optional($._modulepart), field("gate", alias($.gatepart, $.gate))),
      ),

    _modulepart: ($) =>
      prec.left(
        seq(
          alias(
            repeat1(
              seq(
                field("name", alias($._NAME, $.name)),
                optional($._indexvector),
              ),
            ),
            $.module,
          ),
          ".",
        ),
      ),

    gatepart: ($) =>
      seq(
        field("name", alias($._NAME, $.name)),
        optional($._indexvector),
        choice(
          seq(
            optional($.subgate),
            field("plusplpus", alias(optional("++"), $.plusplus)),
          ),
          seq(optional($.subgate), $._indexvector),
        ),
      ),

    _loops_and_conditions: ($) =>
      seq($._loop_or_condition, repeat(seq(",", $._loop_or_condition))),

    _loop_or_condition: ($) => choice($.loop, $.condition),

    loop: ($) =>
      seq(
        "for",
        field("parame_name", alias($._NAME, $.param_name)),
        "=",
        field("from_value", alias($._expression, $.from_value)),
        "..",
        field("to_value", alias($._expression, $.to_value)),
      ),

    subgate: ($) => choice("$i", "$o"),

    _channelspec: ($) =>
      choice(
        $._channelspec_header,
        seq($._channelspec_header, "{", optional($._params), "}"),
        seq("{", $._params, "}"),
      ),

    _channelspec_header: ($) =>
      choice(
        field("name", alias($.channelname, $.name)),
        field("name", alias($._dottedname, $.name)),
        seq(
          field("name", alias($.channelname, $.name)),
          field("type", alias($._dottedname, $.type)),
        ),
        seq(
          optional(field("name", alias($.channelname, $.name))),
          field("like_expr", alias($.likeexpr, $.like_expr)),
          "like",
          field("like_type", alias($._dottedname, $.like_type)),
        ),
      ),

    channelname: ($) => seq($._NAME, ":"),

    condition: ($) =>
      seq("if", field("value", field("value", alias($._expression, $.value)))),

    ifblock: ($) =>
      prec(
        1,
        seq($.condition, "{", repeat(choice($.connection, $.comment)), "}"),
      ),

    forblock: ($) =>
      prec(
        1,
        seq(
          seq($.loop, repeat(seq(",", $.loop))),
          "{",
          repeat(choice($.connection, $.comment)),
          "}",
          optional(";"),
        ),
      ),

    sizevector: ($) =>
      seq("[", field("size", alias($._expression, $.size)), "]"),

    _indexvector: ($) =>
      seq("[", field("index", alias($._expression, $.index)), "]"),

    _expression: ($) =>
      prec.right(
        10,
        choice(
          $._simple_expr,
          $._functioncall,
          seq($._expression, ".", $._functioncall),
          $.object,
          $.array,
          seq("(", $._expression, ")"),

          seq($._expression, "+", $._expression),
          seq($._expression, "-", $._expression),
          seq($._expression, "*", $._expression),
          seq($._expression, "/", $._expression),
          seq($._expression, "%", $._expression),
          seq($._expression, "^", $._expression),
          seq("-", $._expression),

          seq($._expression, "==", $._expression),
          seq($._expression, "!=", $._expression),
          seq($._expression, ">", $._expression),
          seq($._expression, ">=", $._expression),
          seq($._expression, "<", $._expression),
          seq($._expression, "<=", $._expression),
          seq($._expression, "<=>", $._expression),
          seq($._expression, "match", $._expression),

          seq($._expression, "&&", $._expression),
          seq($._expression, "||", $._expression),
          seq($._expression, "^^", $._expression),

          seq("!", $._expression),

          seq($._expression, "&", $._expression),
          seq($._expression, "|", $._expression),
          seq($._expression, "#", $._expression),

          seq("~", $._expression),
          seq($._expression, "<<", $._expression),
          seq($._expression, ">>", $._expression),

          seq($._expression, "?", $._expression, ":", $._expression),
        ),
      ),

    _functioncall: ($) => seq($._funcname, "(", optional($._exprlist), ")"),

    array: ($) =>
      choice(
        seq("[", "]"),
        seq("[", $._exprlist, "]"),
        seq("[", $._exprlist, ",", "]"),
      ),

    object: ($) =>
      choice(
        seq("{", optional($.keyvaluelist), "}"),
        seq($._NAME, "{", optional($.keyvaluelist), "}"),
        seq($._NAME, "::", $._NAME, "{", optional($.keyvaluelist), "}"),
        seq(
          $._NAME,
          "::",
          $._NAME,
          "::",
          $._NAME,
          "{",
          optional($.keyvaluelist),
          "}",
        ),
        seq(
          $._NAME,
          "::",
          $._NAME,
          "::",
          $._NAME,
          "::",
          $._NAME,
          "{",
          optional($.keyvaluelist),
          "}",
        ),
      ),

    _exprlist: ($) =>
      prec.right(seq($._expression, repeat(seq(",", $._expression)))),

    keyvaluelist: ($) => seq($.keyvalue, repeat1(seq(",", $.keyvalue))),

    keyvalue: ($) => seq($.key, ":", $._expression),

    key: ($) =>
      choice(
        $._STRINGCONSTANT,
        $._NAME,
        $._INTCONSTANT,
        $._REALCONSTANT,
        $._quantity,
        seq("-", $._INTCONSTANT),
        seq("-", $._REALCONSTANT),
        seq("-", $._quantity),
        "nan",
        "inf",
        seq("-", "inf"),
        "true",
        "false",
        "null",
        "nullptr",
      ),

    _simple_expr: ($) => choice($._qname, $.operator, $._literal),

    _funcname: ($) =>
      choice(
        $._qname,
        "bool",
        "int",
        "double",
        "string",
        "object",
        "xml",
        "xmldoc",
      ),

    _qname_elem: ($) =>
      prec.right(
        10,
        choice(
          $._NAME,
          seq($._NAME, "[", $._expression, "]"),
          "this",
          "parent",
        ),
      ),

    _qname: ($) =>
      prec.right(seq($._qname_elem, repeat(seq(".", $._qname_elem)))),

    operator: ($) =>
      prec(
        20,
        choice(
          seq($._qname, ".", "index"),
          seq($._qname, ".", "typename"),
          seq("exists", "(", $._qname, ")"),
          seq("sizeof", "(", $._qname, ")"),
        ),
      ),

    _literal: ($) =>
      choice(
        $._STRINGCONSTANT,
        $._XMLCONSTANT,
        $._boolliteral,
        $._numliteral,
        $._otherliteral,
      ),

    _boolliteral: ($) => choice("true", "false"),

    _numliteral: ($) =>
      choice($._INTCONSTANT, $._realconstant_ext, $._quantity),

    _otherliteral: ($) => choice("undefined", "nullptr", "null"),

    _quantity: ($) =>
      prec(
        10,
        choice(
          seq($._quantity, $._INTCONSTANT, $._NAME),
          seq($._quantity, $._realconstant_ext, $._NAME),
          seq($._quantity, $._intconstant_ext, $._NAME),
          seq($._INTCONSTANT, $._NAME),
          seq($._realconstant_ext, $._NAME),
          seq($._intconstant_ext, $._NAME),
        ),
      ),

    _intconstant_ext: ($) => /[0-9]+e[0-9]*/,

    _realconstant_ext: ($) =>
      choice(
        $._REALCONSTANT,
        "inf",
        "nan",
        $._intconstant_ext,
        seq(".", $._INTCONSTANT), // kludge for parsing default(.1s);
      ),

    _NAME: ($) => /[_a-zA-Z][_a-zA-Z0-9]*/,
    _PROPNAME: ($) => /[a-zA-Z_][a-zA-Z0-9_:.-]*/,
    _PROPINDEX: ($) => /[a-zA-Z_][a-zA-Z0-9_*?{}:.-]*/,
    _INTCONSTANT: ($) => /\d+/,
    _REALCONSTANT: ($) => /\d+\.\d+/,
    _STRINGCONSTANT: ($) => /"([^"\\]|\\.)*"/,
    _XMLCONSTANT: ($) => /"[^"]*"|'[^']*'/,
    _EMPTYLINE: ($) => /\r?\n\s*\r?\n\s*/,
    _COMMONCHAR: ($) => /[^"]/,
  },
});
