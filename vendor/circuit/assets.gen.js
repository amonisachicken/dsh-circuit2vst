// 由 scripts/gen-circuit-assets.mjs 生成，请勿手改。
// 来源：vendor/circuit（rustomp-circuit-designer @ f4eaa45，GPL-3.0-or-later）。

export const CIRCUIT_SYMBOLS = {
  "grid": 2.5,
  "symbols": {
    "capacitor": {
      "canvas": {
        "h": 15,
        "w": 30
      },
      "category": "passive",
      "file": "assets/gb4728-symbols-kit/symbols/02-capacitor.svg",
      "models": [],
      "name": {
        "en": "Capacitor",
        "zh": "电容器（无极）"
      },
      "origin": {
        "x": 15,
        "y": 7.5
      },
      "pins": [
        {
          "at": {
            "x": -12.5,
            "y": 0
          },
          "dir": "left",
          "id": "1"
        },
        {
          "at": {
            "x": 12.5,
            "y": 0
          },
          "dir": "right",
          "id": "2"
        }
      ],
      "spice": {
        "pinOrder": [
          "1",
          "2"
        ],
        "prefix": "C"
      },
      "standard": "GB/T 4728.4"
    },
    "diode": {
      "canvas": {
        "h": 15,
        "w": 30
      },
      "category": "diode",
      "file": "assets/gb4728-symbols-kit/symbols/04-diode.svg",
      "models": [
        "1N4148",
        "1N34A",
        "1N4007",
        "1N5817"
      ],
      "name": {
        "en": "Diode",
        "zh": "二极管"
      },
      "origin": {
        "x": 15,
        "y": 7.5
      },
      "pins": [
        {
          "at": {
            "x": -12.5,
            "y": 0
          },
          "dir": "left",
          "id": "A"
        },
        {
          "at": {
            "x": 12.5,
            "y": 0
          },
          "dir": "right",
          "id": "K"
        }
      ],
      "spice": {
        "pinOrder": [
          "A",
          "K"
        ],
        "prefix": "D"
      },
      "standard": "GB/T 4728.5"
    },
    "earth": {
      "canvas": {
        "h": 22.5,
        "w": 15
      },
      "category": "net-label",
      "file": "assets/gb4728-symbols-kit/symbols/12-earth.svg",
      "models": [],
      "name": {
        "en": "Ground",
        "zh": "接地"
      },
      "netName": "0",
      "origin": {
        "x": 7.5,
        "y": 15
      },
      "pins": [
        {
          "at": {
            "x": 0,
            "y": -12.5
          },
          "dir": "up",
          "id": "GND"
        }
      ],
      "spice": {
        "pinOrder": [
          "GND"
        ],
        "prefix": ""
      },
      "standard": "GB/T 4728.2"
    },
    "jfet-n": {
      "canvas": {
        "h": 35,
        "w": 25
      },
      "category": "jfet",
      "file": "assets/gb4728-symbols-kit/symbols/09-jfet-n.svg",
      "models": [
        "J201"
      ],
      "name": {
        "en": "N-channel JFET",
        "zh": "N 沟道结型场效应管"
      },
      "origin": {
        "x": 15,
        "y": 17.5
      },
      "pins": [
        {
          "at": {
            "x": -12.5,
            "y": 0
          },
          "dir": "left",
          "id": "G"
        },
        {
          "at": {
            "x": 2.5,
            "y": -12.5
          },
          "dir": "up",
          "id": "D"
        },
        {
          "at": {
            "x": 2.5,
            "y": 12.5
          },
          "dir": "down",
          "id": "S"
        }
      ],
      "spice": {
        "pinOrder": [
          "D",
          "G",
          "S"
        ],
        "prefix": "J"
      },
      "standard": "GB/T 4728.5"
    },
    "led": {
      "canvas": {
        "h": 20,
        "w": 30
      },
      "category": "led",
      "file": "assets/gb4728-symbols-kit/symbols/05-led.svg",
      "models": [
        "LedRed",
        "LedGreen",
        "LedBLUE"
      ],
      "name": {
        "en": "Light Emitting Diode",
        "zh": "发光二极管"
      },
      "origin": {
        "x": 15,
        "y": 12.5
      },
      "pins": [
        {
          "at": {
            "x": -12.5,
            "y": 0
          },
          "dir": "left",
          "id": "A"
        },
        {
          "at": {
            "x": 12.5,
            "y": 0
          },
          "dir": "right",
          "id": "K"
        }
      ],
      "spice": {
        "pinOrder": [
          "A",
          "K"
        ],
        "prefix": "D"
      },
      "standard": "GB/T 4728.5"
    },
    "mosfet-n": {
      "canvas": {
        "h": 35,
        "w": 27.5
      },
      "category": "mosfet",
      "file": "assets/gb4728-symbols-kit/symbols/10-mosfet-n.svg",
      "models": [
        "2N7000"
      ],
      "name": {
        "en": "N-channel E-MOSFET",
        "zh": "N 沟道增强型 MOSFET"
      },
      "origin": {
        "x": 15,
        "y": 17.5
      },
      "pins": [
        {
          "at": {
            "x": -12.5,
            "y": 0
          },
          "dir": "left",
          "id": "G"
        },
        {
          "at": {
            "x": 5,
            "y": -12.5
          },
          "dir": "up",
          "id": "D"
        },
        {
          "at": {
            "x": 5,
            "y": 12.5
          },
          "dir": "down",
          "id": "S"
        }
      ],
      "spice": {
        "pinOrder": [
          "D",
          "G",
          "S"
        ],
        "prefix": "M"
      },
      "standard": "GB/T 4728.5"
    },
    "nc": {
      "canvas": {
        "h": 15,
        "w": 15
      },
      "category": "nc",
      "file": "assets/gb4728-ext/symbols/20-nc.svg",
      "models": [],
      "name": {
        "en": "No Connect",
        "zh": "空脚"
      },
      "origin": {
        "x": 7.5,
        "y": 7.5
      },
      "pins": [
        {
          "at": {
            "x": -5,
            "y": 0
          },
          "dir": "left",
          "id": "NC"
        }
      ],
      "spice": {
        "pinOrder": [
          "NC"
        ],
        "prefix": ""
      },
      "standard": "GB/T 4728.2（示意画法）"
    },
    "node-in": {
      "canvas": {
        "h": 15,
        "w": 25
      },
      "category": "port",
      "file": "assets/gb4728-symbols-kit/symbols/15-node-in.svg",
      "models": [],
      "name": {
        "en": "Input Node",
        "zh": "In 节点"
      },
      "origin": {
        "x": 10,
        "y": 7.5
      },
      "pins": [
        {
          "at": {
            "x": 12.5,
            "y": 0
          },
          "dir": "right",
          "id": "IN"
        }
      ],
      "port": "in",
      "spice": {
        "pinOrder": [
          "IN"
        ],
        "prefix": ""
      },
      "standard": "GB/T 4728.3"
    },
    "node-out": {
      "canvas": {
        "h": 15,
        "w": 25
      },
      "category": "port",
      "file": "assets/gb4728-symbols-kit/symbols/16-node-out.svg",
      "models": [],
      "name": {
        "en": "Output Node",
        "zh": "Out 节点"
      },
      "origin": {
        "x": 15,
        "y": 7.5
      },
      "pins": [
        {
          "at": {
            "x": -12.5,
            "y": 0
          },
          "dir": "left",
          "id": "OUT"
        }
      ],
      "port": "out",
      "spice": {
        "pinOrder": [
          "OUT"
        ],
        "prefix": ""
      },
      "standard": "GB/T 4728.3"
    },
    "npn": {
      "canvas": {
        "h": 35,
        "w": 27.5
      },
      "category": "bjt",
      "file": "assets/gb4728-symbols-kit/symbols/07-npn.svg",
      "models": [
        "BC549C",
        "AC127"
      ],
      "name": {
        "en": "NPN Transistor",
        "zh": "NPN 型晶体管"
      },
      "origin": {
        "x": 15,
        "y": 17.5
      },
      "pins": [
        {
          "at": {
            "x": -12.5,
            "y": 0
          },
          "dir": "left",
          "id": "B"
        },
        {
          "at": {
            "x": 2.5,
            "y": -12.5
          },
          "dir": "up",
          "id": "C"
        },
        {
          "at": {
            "x": 2.5,
            "y": 12.5
          },
          "dir": "down",
          "id": "E"
        }
      ],
      "spice": {
        "pinOrder": [
          "C",
          "B",
          "E"
        ],
        "prefix": "Q"
      },
      "standard": "GB/T 4728.5"
    },
    "opamp": {
      "canvas": {
        "h": 35,
        "w": 35
      },
      "category": "opamp",
      "file": "assets/gb4728-symbols-kit/symbols/11-opamp.svg",
      "models": [
        "OP07A"
      ],
      "name": {
        "en": "Operational Amplifier",
        "zh": "运算放大器"
      },
      "origin": {
        "x": 17.5,
        "y": 17.5
      },
      "pins": [
        {
          "at": {
            "x": -15,
            "y": -5
          },
          "dir": "left",
          "id": "IN+"
        },
        {
          "at": {
            "x": -15,
            "y": 5
          },
          "dir": "left",
          "id": "IN-"
        },
        {
          "at": {
            "x": 15,
            "y": 0
          },
          "dir": "right",
          "id": "OUT"
        },
        {
          "at": {
            "x": 0,
            "y": -12.5
          },
          "dir": "up",
          "id": "V+"
        },
        {
          "at": {
            "x": 0,
            "y": 12.5
          },
          "dir": "down",
          "id": "V-"
        }
      ],
      "spice": {
        "pinOrder": [
          "IN+",
          "IN-",
          "V+",
          "V-",
          "OUT"
        ],
        "prefix": "X"
      },
      "standard": "GB/T 4728.13"
    },
    "pnp": {
      "canvas": {
        "h": 35,
        "w": 27.5
      },
      "category": "bjt",
      "file": "assets/gb4728-symbols-kit/symbols/08-pnp.svg",
      "models": [
        "BC559C",
        "AC128"
      ],
      "name": {
        "en": "PNP Transistor",
        "zh": "PNP 型晶体管"
      },
      "origin": {
        "x": 15,
        "y": 17.5
      },
      "pins": [
        {
          "at": {
            "x": -12.5,
            "y": 0
          },
          "dir": "left",
          "id": "B"
        },
        {
          "at": {
            "x": 2.5,
            "y": -12.5
          },
          "dir": "up",
          "id": "C"
        },
        {
          "at": {
            "x": 2.5,
            "y": 12.5
          },
          "dir": "down",
          "id": "E"
        }
      ],
      "spice": {
        "pinOrder": [
          "C",
          "B",
          "E"
        ],
        "prefix": "Q"
      },
      "standard": "GB/T 4728.5"
    },
    "potentiometer": {
      "canvas": {
        "h": 22.5,
        "w": 30
      },
      "category": "passive",
      "file": "assets/gb4728-symbols-kit/symbols/03-potentiometer.svg",
      "models": [],
      "name": {
        "en": "Potentiometer",
        "zh": "电位器"
      },
      "origin": {
        "x": 15,
        "y": 17.5
      },
      "pins": [
        {
          "at": {
            "x": -12.5,
            "y": 0
          },
          "dir": "left",
          "id": "1"
        },
        {
          "at": {
            "x": 5,
            "y": -12.5
          },
          "dir": "up",
          "id": "2"
        },
        {
          "at": {
            "x": 12.5,
            "y": 0
          },
          "dir": "right",
          "id": "3"
        }
      ],
      "spice": {
        "pinOrder": [
          "1",
          "2",
          "3"
        ],
        "prefix": "P"
      },
      "standard": "GB/T 4728.4"
    },
    "resistor": {
      "canvas": {
        "h": 10,
        "w": 30
      },
      "category": "passive",
      "file": "assets/gb4728-symbols-kit/symbols/01-resistor.svg",
      "models": [],
      "name": {
        "en": "Resistor",
        "zh": "电阻器"
      },
      "origin": {
        "x": 15,
        "y": 5
      },
      "pins": [
        {
          "at": {
            "x": -12.5,
            "y": 0
          },
          "dir": "left",
          "id": "1"
        },
        {
          "at": {
            "x": 12.5,
            "y": 0
          },
          "dir": "right",
          "id": "2"
        }
      ],
      "spice": {
        "pinOrder": [
          "1",
          "2"
        ],
        "prefix": "R"
      },
      "standard": "GB/T 4728.4"
    },
    "test-point": {
      "canvas": {
        "h": 15,
        "w": 15
      },
      "category": "test-point",
      "file": "assets/gb4728-ext/symbols/19-test-point.svg",
      "models": [],
      "name": {
        "en": "Test Point",
        "zh": "测试点"
      },
      "origin": {
        "x": 7.5,
        "y": 7.5
      },
      "pins": [
        {
          "at": {
            "x": -5,
            "y": 0
          },
          "dir": "left",
          "id": "TP"
        }
      ],
      "spice": {
        "pinOrder": [
          "TP"
        ],
        "prefix": ""
      },
      "standard": "GB/T 4728.2（示意画法）"
    },
    "vcc": {
      "canvas": {
        "h": 22.5,
        "w": 15
      },
      "category": "net-label",
      "file": "assets/gb4728-symbols-kit/symbols/13-vcc.svg",
      "models": [],
      "name": {
        "en": "Supply Vcc",
        "zh": "Vcc 电源端"
      },
      "netName": "VCC",
      "origin": {
        "x": 7.5,
        "y": 7.5
      },
      "pins": [
        {
          "at": {
            "x": 0,
            "y": 12.5
          },
          "dir": "down",
          "id": "VCC"
        }
      ],
      "spice": {
        "pinOrder": [
          "VCC"
        ],
        "prefix": ""
      },
      "standard": "GB/T 4728.3"
    },
    "vee": {
      "canvas": {
        "h": 25,
        "w": 15
      },
      "category": "net-label",
      "file": "assets/gb4728-symbols-kit/symbols/14-vee.svg",
      "models": [],
      "name": {
        "en": "Supply Vee",
        "zh": "Vee 电源端"
      },
      "netName": "VEE",
      "origin": {
        "x": 7.5,
        "y": 15
      },
      "pins": [
        {
          "at": {
            "x": 0,
            "y": -12.5
          },
          "dir": "up",
          "id": "VEE"
        }
      ],
      "spice": {
        "pinOrder": [
          "VEE"
        ],
        "prefix": ""
      },
      "standard": "GB/T 4728.3"
    },
    "voltage-source": {
      "canvas": {
        "h": 30,
        "w": 20
      },
      "category": "source",
      "file": "assets/gb4728-symbols-kit/symbols/06-voltage-source.svg",
      "models": [],
      "name": {
        "en": "Voltage Source",
        "zh": "电压源"
      },
      "origin": {
        "x": 10,
        "y": 15
      },
      "pins": [
        {
          "at": {
            "x": 0,
            "y": -12.5
          },
          "dir": "up",
          "id": "+"
        },
        {
          "at": {
            "x": 0,
            "y": 12.5
          },
          "dir": "down",
          "id": "-"
        }
      ],
      "spice": {
        "pinOrder": [
          "+",
          "-"
        ],
        "prefix": "V"
      },
      "standard": "GB/T 4728.6"
    }
  },
  "unit": "mm",
  "version": 1
}

export const CIRCUIT_ART = {
  "capacitor": {
    "viewBox": "0 0 30 15",
    "inner": "<g transform=\"translate(15.0,7.5)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <line x1=\"-1.25\" y1=\"-5\" x2=\"-1.25\" y2=\"5\" />\n      <line x1=\"1.25\" y1=\"-5\" x2=\"1.25\" y2=\"5\" />\n      <line x1=\"-12.5\" y1=\"0\" x2=\"-1.25\" y2=\"0\" />\n      <line x1=\"1.25\" y1=\"0\" x2=\"12.5\" y2=\"0\" />\n    </g>",
    "texts": []
  },
  "diode": {
    "viewBox": "0 0 30 15",
    "inner": "<g transform=\"translate(15.0,7.5)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M -2.5 -4 L -2.5 4 L 2.5 0 Z\" />\n      <line x1=\"2.5\" y1=\"-4\" x2=\"2.5\" y2=\"4\" />\n      <line x1=\"-12.5\" y1=\"0\" x2=\"-2.5\" y2=\"0\" />\n      <line x1=\"2.5\" y1=\"0\" x2=\"12.5\" y2=\"0\" />\n    </g>",
    "texts": []
  },
  "earth": {
    "viewBox": "0 0 15 22.5",
    "inner": "<g transform=\"translate(7.5,15.0)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <line x1=\"0\" y1=\"-12.5\" x2=\"0\" y2=\"0\" />\n      <line x1=\"-5\" y1=\"0\" x2=\"5\" y2=\"0\" />\n      <line x1=\"-3\" y1=\"2\" x2=\"3\" y2=\"2\" />\n      <line x1=\"-1.5\" y1=\"4\" x2=\"1.5\" y2=\"4\" />\n    </g>",
    "texts": []
  },
  "jfet-n": {
    "viewBox": "0 0 25 35",
    "inner": "<g transform=\"translate(15.0,17.5)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <line x1=\"0\" y1=\"-5\" x2=\"0\" y2=\"5\" stroke-width=\"0.9\" stroke-linecap=\"butt\" />\n      <line x1=\"0\" y1=\"-5\" x2=\"2.5\" y2=\"-5\" stroke-linecap=\"butt\" />\n      <line x1=\"2.5\" y1=\"-5\" x2=\"2.5\" y2=\"-12.5\" />\n      <line x1=\"0\" y1=\"5\" x2=\"2.5\" y2=\"5\" stroke-linecap=\"butt\" />\n      <line x1=\"2.5\" y1=\"5\" x2=\"2.5\" y2=\"12.5\" />\n      <line x1=\"-12.5\" y1=\"0\" x2=\"-0.6\" y2=\"0\" />\n      <path d=\"M -0.5 0 L -2.6 0.7 L -2.6 -0.7 Z\" fill=\"#0f172a\" stroke=\"none\" />\n      <g stroke=\"none\" fill=\"#64748b\" font-size=\"2.4\" font-family=\"Consolas, monospace\" text-anchor=\"start\">\n        \n        \n        \n      </g>\n    </g>",
    "texts": [
      {
        "x": 18.4,
        "y": 6.699999999999999,
        "size": 2.4,
        "anchor": "start",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "D"
      },
      {
        "x": 3.3000000000000007,
        "y": 16.1,
        "size": 2.4,
        "anchor": "start",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "G"
      },
      {
        "x": 18.4,
        "y": 29.6,
        "size": 2.4,
        "anchor": "start",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "S"
      }
    ]
  },
  "led": {
    "viewBox": "0 0 30 20",
    "inner": "<g transform=\"translate(15.0,12.5)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M -2.5 -4 L -2.5 4 L 2.5 0 Z\" />\n      <line x1=\"2.5\" y1=\"-4\" x2=\"2.5\" y2=\"4\" />\n      <line x1=\"-12.5\" y1=\"0\" x2=\"-2.5\" y2=\"0\" />\n      <line x1=\"2.5\" y1=\"0\" x2=\"12.5\" y2=\"0\" />\n      <line x1=\"-1.4\" y1=\"-5.9\" x2=\"1.75\" y2=\"-9.05\" />\n      <path d=\"M 2.1 -9.4 L 1.110 -7.278 L -0.022 -8.410 Z\" fill=\"#0f172a\" stroke=\"none\" />\n      <line x1=\"0.6\" y1=\"-4.4\" x2=\"3.75\" y2=\"-7.55\" />\n      <path d=\"M 4.1 -7.9 L 3.110 -5.778 L 1.978 -6.910 Z\" fill=\"#0f172a\" stroke=\"none\" />\n    </g>",
    "texts": []
  },
  "mosfet-n": {
    "viewBox": "0 0 27.5 35",
    "inner": "<g transform=\"translate(15.0,17.5)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <line x1=\"-4.5\" y1=\"-5\" x2=\"-4.5\" y2=\"5\" />\n      <line x1=\"-12.5\" y1=\"0\" x2=\"-4.5\" y2=\"0\" />\n      <line x1=\"-2.5\" y1=\"-5\" x2=\"-2.5\" y2=\"-2.8\" stroke-width=\"0.9\" stroke-linecap=\"butt\" />\n      <line x1=\"-2.5\" y1=\"-1.1\" x2=\"-2.5\" y2=\"1.1\" stroke-width=\"0.9\" stroke-linecap=\"butt\" />\n      <line x1=\"-2.5\" y1=\"2.8\" x2=\"-2.5\" y2=\"5\" stroke-width=\"0.9\" stroke-linecap=\"butt\" />\n      <line x1=\"-2.5\" y1=\"-5\" x2=\"5\" y2=\"-5\" stroke-linecap=\"butt\" />\n      <line x1=\"5\" y1=\"-5\" x2=\"5\" y2=\"-12.5\" />\n      <line x1=\"-2.5\" y1=\"5\" x2=\"5\" y2=\"5\" stroke-linecap=\"butt\" />\n      <line x1=\"5\" y1=\"5\" x2=\"5\" y2=\"12.5\" />\n      <line x1=\"5\" y1=\"0\" x2=\"5\" y2=\"5\" />\n      <line x1=\"5\" y1=\"0\" x2=\"-2.1\" y2=\"0\" />\n      <path d=\"M -2.1 0 L 0.1 0.7 L 0.1 -0.7 Z\" fill=\"#0f172a\" stroke=\"none\" />\n      <g stroke=\"none\" fill=\"#64748b\" font-size=\"2.4\" font-family=\"Consolas, monospace\" text-anchor=\"start\">\n        \n        \n        \n      </g>\n    </g>",
    "texts": [
      {
        "x": 21,
        "y": 6.699999999999999,
        "size": 2.4,
        "anchor": "start",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "D"
      },
      {
        "x": 3.3000000000000007,
        "y": 16.1,
        "size": 2.4,
        "anchor": "start",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "G"
      },
      {
        "x": 21,
        "y": 29.6,
        "size": 2.4,
        "anchor": "start",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "S"
      }
    ]
  },
  "nc": {
    "viewBox": "0 0 15 15",
    "inner": "<g transform=\"translate(7.5,7.5)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <line x1=\"-5\" y1=\"0\" x2=\"-1.5\" y2=\"0\" />\n      <line x1=\"-1.5\" y1=\"-2.5\" x2=\"3.5\" y2=\"2.5\" />\n      <line x1=\"-1.5\" y1=\"2.5\" x2=\"3.5\" y2=\"-2.5\" />\n    </g>",
    "texts": []
  },
  "node-in": {
    "viewBox": "0 0 25 15",
    "inner": "<g transform=\"translate(10.0,7.5)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <!-- IN 是 OUT 的水平镜像：引脚在右侧（朝电路），尖角朝左 -->\n      <line x1=\"12.5\" y1=\"0\" x2=\"6\" y2=\"0\" />\n      <path d=\"M 6 -5 L -2 -5 L -6 0 L -2 5 L 6 5 Z\" />\n      \n    </g>",
    "texts": [
      {
        "x": 12.2,
        "y": 8.45,
        "size": 2.6,
        "anchor": "middle",
        "fill": "#0f172a",
        "family": "Consolas, monospace",
        "content": "In"
      }
    ]
  },
  "node-out": {
    "viewBox": "0 0 25 15",
    "inner": "<g transform=\"translate(15.0,7.5)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <line x1=\"-12.5\" y1=\"0\" x2=\"-6\" y2=\"0\" />\n      <path d=\"M -6 -5 L 2 -5 L 6 0 L 2 5 L -6 5 Z\" />\n      \n    </g>",
    "texts": [
      {
        "x": 13,
        "y": 8.45,
        "size": 2.6,
        "anchor": "middle",
        "fill": "#0f172a",
        "family": "Consolas, monospace",
        "content": "Out"
      }
    ]
  },
  "npn": {
    "viewBox": "0 0 27.5 35",
    "inner": "<g transform=\"translate(15.0,17.5)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <circle cx=\"0\" cy=\"0\" r=\"8.4\" />\n      <line x1=\"-4\" y1=\"-3\" x2=\"-4\" y2=\"3\" stroke-width=\"0.9\" stroke-linecap=\"butt\" />\n      <line x1=\"-12.5\" y1=\"0\" x2=\"-4\" y2=\"0\" />\n      <line x1=\"-4\" y1=\"-1.5\" x2=\"2.5\" y2=\"-8\" />\n      <line x1=\"2.5\" y1=\"-8\" x2=\"2.5\" y2=\"-12.5\" />\n      <line x1=\"-4\" y1=\"1.5\" x2=\"2.5\" y2=\"8\" />\n      <line x1=\"2.5\" y1=\"8\" x2=\"2.5\" y2=\"12.5\" />\n      <path d=\"M 1.3 6.8 L -0.786 5.774 L 0.274 4.714 Z\" fill=\"#0f172a\" stroke=\"none\" />\n      <g stroke=\"none\" fill=\"#64748b\" font-size=\"2.4\" font-family=\"Consolas, monospace\" text-anchor=\"start\">\n        \n        \n        \n      </g>\n    </g>",
    "texts": [
      {
        "x": 18.6,
        "y": 6.699999999999999,
        "size": 2.4,
        "anchor": "start",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "C"
      },
      {
        "x": 3.3000000000000007,
        "y": 16.1,
        "size": 2.4,
        "anchor": "start",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "B"
      },
      {
        "x": 18.6,
        "y": 29.6,
        "size": 2.4,
        "anchor": "start",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "E"
      }
    ]
  },
  "opamp": {
    "viewBox": "0 0 35 35",
    "inner": "<g transform=\"translate(17.5,17.5)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <path d=\"M -10 -8 L 10 0 L -10 8 Z\" />\n      <line x1=\"-15\" y1=\"-5\" x2=\"-10\" y2=\"-5\" />\n      <line x1=\"-15\" y1=\"5\" x2=\"-10\" y2=\"5\" />\n      <line x1=\"10\" y1=\"0\" x2=\"15\" y2=\"0\" />\n      <line x1=\"0\" y1=\"-4\" x2=\"0\" y2=\"-12.5\" />\n      <line x1=\"0\" y1=\"4\" x2=\"0\" y2=\"12.5\" />\n      <g stroke-width=\"0.5\" stroke-linecap=\"round\">\n        <line x1=\"-9.2\" y1=\"-5\" x2=\"-6.8\" y2=\"-5\" />\n        <line x1=\"-8\" y1=\"-6.2\" x2=\"-8\" y2=\"-3.8\" />\n        <line x1=\"-9.2\" y1=\"5\" x2=\"-6.8\" y2=\"5\" />\n      </g>\n      <g stroke=\"none\" fill=\"#64748b\" font-size=\"2.4\" font-family=\"Consolas, monospace\" text-anchor=\"start\">\n        \n        \n      </g>\n    </g>",
    "texts": [
      {
        "x": 18.9,
        "y": 6.6,
        "size": 2.4,
        "anchor": "start",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "V+"
      },
      {
        "x": 18.9,
        "y": 29.6,
        "size": 2.4,
        "anchor": "start",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "V−"
      }
    ]
  },
  "pnp": {
    "viewBox": "0 0 27.5 35",
    "inner": "<g transform=\"translate(15.0,17.5)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <circle cx=\"0\" cy=\"0\" r=\"8.4\" />\n      <line x1=\"-4\" y1=\"-3\" x2=\"-4\" y2=\"3\" stroke-width=\"0.9\" stroke-linecap=\"butt\" />\n      <line x1=\"-12.5\" y1=\"0\" x2=\"-4\" y2=\"0\" />\n      <line x1=\"-4\" y1=\"-1.5\" x2=\"2.5\" y2=\"-8\" />\n      <line x1=\"2.5\" y1=\"-8\" x2=\"2.5\" y2=\"-12.5\" />\n      <line x1=\"-4\" y1=\"1.5\" x2=\"2.5\" y2=\"8\" />\n      <line x1=\"2.5\" y1=\"8\" x2=\"2.5\" y2=\"12.5\" />\n      <path d=\"M -3 2.5 L -0.914 3.526 L -1.974 4.586 Z\" fill=\"#0f172a\" stroke=\"none\" />\n      <g stroke=\"none\" fill=\"#64748b\" font-size=\"2.4\" font-family=\"Consolas, monospace\" text-anchor=\"start\">\n        \n        \n        \n      </g>\n    </g>",
    "texts": [
      {
        "x": 18.6,
        "y": 6.699999999999999,
        "size": 2.4,
        "anchor": "start",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "C"
      },
      {
        "x": 3.3000000000000007,
        "y": 16.1,
        "size": 2.4,
        "anchor": "start",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "B"
      },
      {
        "x": 18.6,
        "y": 29.6,
        "size": 2.4,
        "anchor": "start",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "E"
      }
    ]
  },
  "potentiometer": {
    "viewBox": "0 0 30 22.5",
    "inner": "<g transform=\"translate(15.0,17.5)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <rect x=\"-6\" y=\"-2\" width=\"12\" height=\"4\" />\n      <line x1=\"-12.5\" y1=\"0\" x2=\"-6\" y2=\"0\" />\n      <line x1=\"6\" y1=\"0\" x2=\"12.5\" y2=\"0\" />\n      <line x1=\"5\" y1=\"-12.5\" x2=\"5\" y2=\"-7.5\" />\n      <line x1=\"5\" y1=\"-7.5\" x2=\"0.35\" y2=\"-2.35\" />\n      <path d=\"M 0 -2 L 0.925 -4.134 L 2.035 -3.125 Z\" fill=\"#0f172a\" stroke=\"none\" />\n      <g stroke=\"none\" fill=\"#64748b\" font-size=\"2.4\" font-family=\"Consolas, monospace\">\n        \n        \n        \n      </g>\n    </g>",
    "texts": [
      {
        "x": 3.4000000000000004,
        "y": 16.1,
        "size": 2.4,
        "anchor": "start",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "1"
      },
      {
        "x": 20.9,
        "y": 6.300000000000001,
        "size": 2.4,
        "anchor": "start",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "2"
      },
      {
        "x": 26.6,
        "y": 16.1,
        "size": 2.4,
        "anchor": "end",
        "fill": "#64748b",
        "family": "Consolas, monospace",
        "content": "3"
      }
    ]
  },
  "resistor": {
    "viewBox": "0 0 30 10",
    "inner": "<g transform=\"translate(15.0,5.0)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <rect x=\"-6\" y=\"-2\" width=\"12\" height=\"4\" />\n      <line x1=\"-12.5\" y1=\"0\" x2=\"-6\" y2=\"0\" />\n      <line x1=\"6\" y1=\"0\" x2=\"12.5\" y2=\"0\" />\n    </g>",
    "texts": []
  },
  "test-point": {
    "viewBox": "0 0 15 15",
    "inner": "<g transform=\"translate(7.5,7.5)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <line x1=\"-5\" y1=\"0\" x2=\"1.5\" y2=\"0\" />\n      <circle cx=\"3.8\" cy=\"0\" r=\"2.3\" />\n    </g>",
    "texts": []
  },
  "vcc": {
    "viewBox": "0 0 15 22.5",
    "inner": "<g transform=\"translate(7.5,7.5)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <line x1=\"0\" y1=\"12.5\" x2=\"0\" y2=\"0\" />\n      <line x1=\"-4\" y1=\"0\" x2=\"4\" y2=\"0\" stroke-width=\"0.9\" stroke-linecap=\"butt\" />\n      \n    </g>",
    "texts": [
      {
        "x": 7.5,
        "y": 4.7,
        "size": 2.8,
        "anchor": "middle",
        "fill": "#0f172a",
        "family": "Consolas, monospace",
        "content": "Vcc"
      }
    ]
  },
  "vee": {
    "viewBox": "0 0 15 25",
    "inner": "<g transform=\"translate(7.5,15.0)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <line x1=\"0\" y1=\"-12.5\" x2=\"0\" y2=\"0\" />\n      <line x1=\"-4\" y1=\"0\" x2=\"4\" y2=\"0\" stroke-width=\"0.9\" stroke-linecap=\"butt\" />\n      \n    </g>",
    "texts": [
      {
        "x": 7.5,
        "y": 19.9,
        "size": 2.8,
        "anchor": "middle",
        "fill": "#0f172a",
        "family": "Consolas, monospace",
        "content": "Vee"
      }
    ]
  },
  "voltage-source": {
    "viewBox": "0 0 20 30",
    "inner": "<g transform=\"translate(10.0,15.0)\" fill=\"none\" stroke=\"#0f172a\" stroke-width=\"0.45\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <circle cx=\"0\" cy=\"0\" r=\"7.5\" />\n      <line x1=\"0\" y1=\"-12.5\" x2=\"0\" y2=\"-7.5\" />\n      <line x1=\"0\" y1=\"7.5\" x2=\"0\" y2=\"12.5\" />\n      <g stroke-width=\"0.5\" stroke-linecap=\"round\">\n        <line x1=\"-1.5\" y1=\"-3.4\" x2=\"1.5\" y2=\"-3.4\" />\n        <line x1=\"0\" y1=\"-4.9\" x2=\"0\" y2=\"-1.9\" />\n        <line x1=\"-1.5\" y1=\"3.4\" x2=\"1.5\" y2=\"3.4\" />\n      </g>\n    </g>",
    "texts": []
  }
}

export const CIRCUIT_EXAMPLES = {
  "common-emitter": {
    "version": 1,
    "name": "共射前级（NPN）",
    "parts": [
      {
        "id": "p1",
        "ref": "Q1",
        "symbol": "npn",
        "at": {
          "x": 0,
          "y": 0
        },
        "rot": 0,
        "mirror": "none",
        "model": "BC549C"
      },
      {
        "id": "p2",
        "ref": "R1",
        "symbol": "resistor",
        "at": {
          "x": 2.5,
          "y": -25
        },
        "rot": 90,
        "mirror": "none",
        "value": "10k"
      },
      {
        "id": "p3",
        "ref": "R2",
        "symbol": "resistor",
        "at": {
          "x": 2.5,
          "y": 25
        },
        "rot": 90,
        "mirror": "none",
        "value": "1k"
      },
      {
        "id": "p4",
        "ref": "R3",
        "symbol": "resistor",
        "at": {
          "x": -12.5,
          "y": -25
        },
        "rot": 90,
        "mirror": "none",
        "value": "470k"
      },
      {
        "id": "p5",
        "ref": "C1",
        "symbol": "capacitor",
        "at": {
          "x": -37.5,
          "y": 0
        },
        "rot": 0,
        "mirror": "none",
        "value": "47n"
      },
      {
        "id": "p6",
        "ref": "C2",
        "symbol": "capacitor",
        "at": {
          "x": 17.5,
          "y": -12.5
        },
        "rot": 0,
        "mirror": "none",
        "value": "1u"
      },
      {
        "id": "p7",
        "ref": "IN1",
        "symbol": "node-in",
        "at": {
          "x": -62.5,
          "y": 0
        },
        "rot": 0,
        "mirror": "none"
      },
      {
        "id": "p8",
        "ref": "OUT1",
        "symbol": "node-out",
        "at": {
          "x": 42.5,
          "y": -12.5
        },
        "rot": 0,
        "mirror": "none"
      },
      {
        "id": "p9",
        "ref": "VCC1",
        "symbol": "vcc",
        "at": {
          "x": 2.5,
          "y": -50
        },
        "rot": 0,
        "mirror": "none"
      },
      {
        "id": "p10",
        "ref": "GND1",
        "symbol": "earth",
        "at": {
          "x": 2.5,
          "y": 50
        },
        "rot": 0,
        "mirror": "none"
      }
    ],
    "wires": [
      {
        "id": "w11",
        "points": [
          {
            "x": -25,
            "y": 0
          },
          {
            "x": -12.5,
            "y": 0
          }
        ]
      },
      {
        "id": "w12",
        "points": [
          {
            "x": -12.5,
            "y": 0
          },
          {
            "x": -12.5,
            "y": -12.5
          }
        ]
      },
      {
        "id": "w13",
        "points": [
          {
            "x": -12.5,
            "y": -37.5
          },
          {
            "x": 2.5,
            "y": -37.5
          }
        ]
      },
      {
        "id": "w14",
        "points": [
          {
            "x": 2.5,
            "y": -12.5
          },
          {
            "x": 5,
            "y": -12.5
          }
        ]
      }
    ],
    "nextId": 15
  },
  "diode-clip": {
    "version": 1,
    "name": "二极管削波（非对称）",
    "parts": [
      {
        "id": "p1",
        "ref": "IN1",
        "symbol": "node-in",
        "at": {
          "x": -45,
          "y": 0
        },
        "rot": 0,
        "mirror": "none"
      },
      {
        "id": "p2",
        "ref": "OUT1",
        "symbol": "node-out",
        "at": {
          "x": 60,
          "y": 0
        },
        "rot": 0,
        "mirror": "none"
      },
      {
        "id": "p3",
        "ref": "R1",
        "symbol": "resistor",
        "at": {
          "x": -20,
          "y": 0
        },
        "rot": 0,
        "mirror": "none",
        "value": "10k"
      },
      {
        "id": "p4",
        "ref": "D1",
        "symbol": "diode",
        "at": {
          "x": 20,
          "y": 15
        },
        "rot": 90,
        "mirror": "none",
        "model": "1N4148"
      },
      {
        "id": "p5",
        "ref": "D2",
        "symbol": "diode",
        "at": {
          "x": 35,
          "y": 15
        },
        "rot": 270,
        "mirror": "none",
        "model": "1N34A"
      },
      {
        "id": "p6",
        "ref": "GND1",
        "symbol": "earth",
        "at": {
          "x": 20,
          "y": 40
        },
        "rot": 0,
        "mirror": "none"
      }
    ],
    "wires": [
      {
        "id": "w7",
        "points": [
          {
            "x": -7.5,
            "y": 0
          },
          {
            "x": 47.5,
            "y": 0
          }
        ]
      },
      {
        "id": "w8",
        "points": [
          {
            "x": 20,
            "y": 0
          },
          {
            "x": 20,
            "y": 2.5
          }
        ]
      },
      {
        "id": "w9",
        "points": [
          {
            "x": 35,
            "y": 0
          },
          {
            "x": 35,
            "y": 2.5
          }
        ]
      },
      {
        "id": "w10",
        "points": [
          {
            "x": 35,
            "y": 27.5
          },
          {
            "x": 20,
            "y": 27.5
          }
        ]
      }
    ],
    "nextId": 11
  },
  "lowpass": {
    "version": 1,
    "name": "一阶低通",
    "parts": [
      {
        "id": "p1",
        "ref": "R1",
        "symbol": "resistor",
        "value": "10k",
        "at": {
          "x": 0,
          "y": 0
        },
        "rot": 0,
        "mirror": "none"
      },
      {
        "id": "p2",
        "ref": "C1",
        "symbol": "capacitor",
        "value": "100n",
        "at": {
          "x": 25,
          "y": 12.5
        },
        "rot": 90,
        "mirror": "none"
      },
      {
        "id": "p3",
        "ref": "GND1",
        "symbol": "earth",
        "at": {
          "x": 25,
          "y": 37.5
        },
        "rot": 0,
        "mirror": "none"
      },
      {
        "id": "p4",
        "ref": "IN1",
        "symbol": "node-in",
        "at": {
          "x": -45,
          "y": 0
        },
        "rot": 0,
        "mirror": "none"
      },
      {
        "id": "p5",
        "ref": "OUT1",
        "symbol": "node-out",
        "at": {
          "x": 50,
          "y": 0
        },
        "rot": 0,
        "mirror": "none"
      },
      {
        "id": "p6",
        "ref": "TP1",
        "symbol": "test-point",
        "at": {
          "x": 40,
          "y": 10
        },
        "rot": 0,
        "mirror": "none"
      }
    ],
    "wires": [
      {
        "id": "w1",
        "points": [
          {
            "x": -32.5,
            "y": 0
          },
          {
            "x": -12.5,
            "y": 0
          }
        ]
      },
      {
        "id": "w2",
        "points": [
          {
            "x": 12.5,
            "y": 0
          },
          {
            "x": 37.5,
            "y": 0
          }
        ]
      },
      {
        "id": "w3",
        "points": [
          {
            "x": 35,
            "y": 10
          },
          {
            "x": 35,
            "y": 0
          }
        ]
      }
    ],
    "nextId": 20
  },
  "noninverting": {
    "version": 1,
    "name": "同相放大（非反相）",
    "parts": [
      {
        "id": "p1",
        "ref": "U1",
        "symbol": "opamp",
        "at": {
          "x": 0,
          "y": 0
        },
        "rot": 0,
        "mirror": "none",
        "model": "OP07A"
      },
      {
        "id": "p2",
        "ref": "IN1",
        "symbol": "node-in",
        "at": {
          "x": -45,
          "y": -5
        },
        "rot": 0,
        "mirror": "none"
      },
      {
        "id": "p3",
        "ref": "OUT1",
        "symbol": "node-out",
        "at": {
          "x": 60,
          "y": 0
        },
        "rot": 0,
        "mirror": "none"
      },
      {
        "id": "p4",
        "ref": "R1",
        "symbol": "resistor",
        "at": {
          "x": -5,
          "y": -25
        },
        "rot": 0,
        "mirror": "none",
        "value": "100k"
      },
      {
        "id": "p5",
        "ref": "R2",
        "symbol": "resistor",
        "at": {
          "x": -30,
          "y": 17.5
        },
        "rot": 90,
        "mirror": "none",
        "value": "10k"
      },
      {
        "id": "p6",
        "ref": "VCC1",
        "symbol": "vcc",
        "at": {
          "x": 0,
          "y": -45
        },
        "rot": 0,
        "mirror": "none"
      },
      {
        "id": "p7",
        "ref": "VEE1",
        "symbol": "vee",
        "at": {
          "x": 40,
          "y": 40
        },
        "rot": 0,
        "mirror": "none"
      },
      {
        "id": "p8",
        "ref": "GND1",
        "symbol": "earth",
        "at": {
          "x": -30,
          "y": 42.5
        },
        "rot": 0,
        "mirror": "none"
      }
    ],
    "wires": [
      {
        "id": "w9",
        "points": [
          {
            "x": -32.5,
            "y": -5
          },
          {
            "x": -15,
            "y": -5
          }
        ]
      },
      {
        "id": "w10",
        "points": [
          {
            "x": 15,
            "y": 0
          },
          {
            "x": 7.5,
            "y": 0
          }
        ]
      },
      {
        "id": "w11",
        "points": [
          {
            "x": 7.5,
            "y": 0
          },
          {
            "x": 7.5,
            "y": -25
          }
        ]
      },
      {
        "id": "w12",
        "points": [
          {
            "x": -17.5,
            "y": -25
          },
          {
            "x": -17.5,
            "y": 5
          }
        ]
      },
      {
        "id": "w13",
        "points": [
          {
            "x": -17.5,
            "y": 5
          },
          {
            "x": -15,
            "y": 5
          }
        ]
      },
      {
        "id": "w14",
        "points": [
          {
            "x": -15,
            "y": 5
          },
          {
            "x": -30,
            "y": 5
          }
        ]
      },
      {
        "id": "w15",
        "points": [
          {
            "x": 15,
            "y": 0
          },
          {
            "x": 47.5,
            "y": 0
          }
        ]
      },
      {
        "id": "w16",
        "points": [
          {
            "x": 0,
            "y": -12.5
          },
          {
            "x": 0,
            "y": -32.5
          }
        ]
      },
      {
        "id": "w17",
        "points": [
          {
            "x": 0,
            "y": 12.5
          },
          {
            "x": 0,
            "y": 27.5
          }
        ]
      },
      {
        "id": "w18",
        "points": [
          {
            "x": 0,
            "y": 27.5
          },
          {
            "x": 40,
            "y": 27.5
          }
        ]
      }
    ],
    "nextId": 19
  }
}
