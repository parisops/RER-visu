/*
 * destinations-observed.js — Destinations RÉELLES observées dans le GTFS statique
 * IDFM (route IDFM:C01727, 4434 trajets), par gare et par sens (A = vers le
 * nord/ouest sur le schéma, B = vers le sud), avec leur fréquence réelle.
 *
 * Remplace les pools de destinations "devinées" (6 termini fixes) de
 * mock-schedule.js : la réalité a beaucoup plus de terminus partiels
 * (Juvisy, Montigny - Beauchamp, Brétigny, Gare d'Austerlitz, Bibliothèque
 * François Mitterrand, Invalides...) que les 6 bouts de branche.
 *
 * Regénération : tools/mine_destinations.py à partir de trips.csv + stop_times.csv
 * (export filtré via tools/filter_gtfs.py).
 *
 * Expose (global) : OBSERVED_DESTINATIONS = { "seg:idx": { A:[[name,count],...], B:[...] } }
 */

const OBSERVED_DESTINATIONS = {
  "orly:0": {
    "A": [
      [
        "Gare d'Austerlitz",
        218
      ],
      [
        "Pontoise",
        142
      ],
      [
        "Montigny - Beauchamp",
        139
      ]
    ],
    "B": [
      [
        "Massy - Palaiseau",
        237
      ]
    ]
  },
  "orly:4": {
    "A": [
      [
        "Pont de Rungis Aéroport d'Orly",
        266
      ],
      [
        "Gare d'Austerlitz",
        218
      ],
      [
        "Pontoise",
        142
      ],
      [
        "Montigny - Beauchamp",
        139
      ]
    ],
    "B": [
      [
        "Massy - Palaiseau",
        237
      ]
    ]
  },
  "spine:30": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        468
      ],
      [
        "Gare d'Austerlitz",
        234
      ],
      [
        "Pontoise",
        154
      ],
      [
        "Montigny - Beauchamp",
        139
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        32
      ],
      [
        "Invalides",
        8
      ]
    ],
    "B": [
      [
        "Juvisy",
        509
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        266
      ],
      [
        "Massy - Palaiseau",
        237
      ],
      [
        "Brétigny",
        40
      ]
    ]
  },
  "spine:29": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        439
      ],
      [
        "Gare d'Austerlitz",
        233
      ],
      [
        "Pontoise",
        132
      ],
      [
        "Montigny - Beauchamp",
        126
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        16
      ]
    ],
    "B": [
      [
        "Juvisy",
        444
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        250
      ],
      [
        "Massy - Palaiseau",
        225
      ],
      [
        "Brétigny",
        40
      ]
    ]
  },
  "spine:28": {
    "A": [
      [
        "Gare d'Austerlitz",
        233
      ],
      [
        "Pontoise",
        136
      ],
      [
        "Montigny - Beauchamp",
        126
      ],
      [
        "Versailles Château Rive Gauche",
        68
      ],
      [
        "Invalides",
        8
      ]
    ],
    "B": [
      [
        "Pont de Rungis Aéroport d'Orly",
        250
      ],
      [
        "Massy - Palaiseau",
        225
      ],
      [
        "Juvisy",
        74
      ],
      [
        "Brétigny",
        40
      ]
    ]
  },
  "spine:27": {
    "A": [
      [
        "Gare d'Austerlitz",
        233
      ],
      [
        "Pontoise",
        136
      ],
      [
        "Montigny - Beauchamp",
        126
      ],
      [
        "Versailles Château Rive Gauche",
        68
      ],
      [
        "Invalides",
        8
      ]
    ],
    "B": [
      [
        "Pont de Rungis Aéroport d'Orly",
        250
      ],
      [
        "Massy - Palaiseau",
        225
      ],
      [
        "Juvisy",
        106
      ],
      [
        "Brétigny",
        40
      ]
    ]
  },
  "spine:26": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        520
      ],
      [
        "Gare d'Austerlitz",
        266
      ],
      [
        "Musée d'Orsay",
        218
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        186
      ],
      [
        "Montigny - Beauchamp",
        175
      ],
      [
        "Pontoise",
        174
      ],
      [
        "Invalides",
        99
      ],
      [
        "Chaville - Vélizy",
        56
      ]
    ],
    "B": [
      [
        "Juvisy",
        511
      ],
      [
        "Saint-Martin d'Étampes",
        287
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        265
      ],
      [
        "Massy - Palaiseau",
        237
      ],
      [
        "Dourdan",
        163
      ],
      [
        "Dourdan la Forêt",
        114
      ],
      [
        "Brétigny",
        70
      ]
    ]
  },
  "spine:25": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        520
      ],
      [
        "Musée d'Orsay",
        218
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        190
      ],
      [
        "Montigny - Beauchamp",
        175
      ],
      [
        "Pontoise",
        174
      ],
      [
        "Invalides",
        99
      ],
      [
        "Chaville - Vélizy",
        56
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Juvisy",
        511
      ],
      [
        "Saint-Martin d'Étampes",
        287
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        265
      ],
      [
        "Massy - Palaiseau",
        237
      ],
      [
        "Dourdan",
        163
      ],
      [
        "Dourdan la Forêt",
        114
      ],
      [
        "Brétigny",
        70
      ],
      [
        "Bibliothèque François Mitterrand",
        54
      ]
    ]
  },
  "spine:24": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        520
      ],
      [
        "Musée d'Orsay",
        218
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        190
      ],
      [
        "Montigny - Beauchamp",
        175
      ],
      [
        "Pontoise",
        174
      ],
      [
        "Invalides",
        99
      ],
      [
        "Chaville - Vélizy",
        56
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Juvisy",
        511
      ],
      [
        "Saint-Martin d'Étampes",
        279
      ],
      [
        "Dourdan",
        158
      ],
      [
        "Massy - Palaiseau",
        137
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Dourdan la Forêt",
        114
      ],
      [
        "Brétigny",
        55
      ],
      [
        "Bibliothèque François Mitterrand",
        54
      ]
    ]
  },
  "spine:23": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        520
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        190
      ],
      [
        "Montigny - Beauchamp",
        175
      ],
      [
        "Pontoise",
        174
      ],
      [
        "Invalides",
        99
      ],
      [
        "Chaville - Vélizy",
        56
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Juvisy",
        511
      ],
      [
        "Saint-Martin d'Étampes",
        279
      ],
      [
        "Dourdan",
        158
      ],
      [
        "Massy - Palaiseau",
        137
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Dourdan la Forêt",
        114
      ],
      [
        "Brétigny",
        55
      ],
      [
        "Bibliothèque François Mitterrand",
        54
      ]
    ]
  },
  "spine:22": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        589
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        289
      ],
      [
        "Montigny - Beauchamp",
        287
      ],
      [
        "Pontoise",
        270
      ],
      [
        "Chaville - Vélizy",
        56
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Juvisy",
        511
      ],
      [
        "Saint-Martin d'Étampes",
        165
      ],
      [
        "Massy - Palaiseau",
        137
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Dourdan",
        79
      ],
      [
        "Dourdan la Forêt",
        78
      ],
      [
        "Brétigny",
        55
      ],
      [
        "Bibliothèque François Mitterrand",
        54
      ]
    ]
  },
  "spine:21": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        589
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        289
      ],
      [
        "Montigny - Beauchamp",
        287
      ],
      [
        "Pontoise",
        270
      ],
      [
        "Chaville - Vélizy",
        56
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Juvisy",
        511
      ],
      [
        "Invalides",
        396
      ],
      [
        "Saint-Martin d'Étampes",
        149
      ],
      [
        "Massy - Palaiseau",
        137
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Bibliothèque François Mitterrand",
        54
      ],
      [
        "Dourdan",
        48
      ],
      [
        "Brétigny",
        36
      ]
    ]
  },
  "spine:20": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        589
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        289
      ],
      [
        "Montigny - Beauchamp",
        287
      ],
      [
        "Pontoise",
        270
      ],
      [
        "Chaville - Vélizy",
        56
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Juvisy",
        511
      ],
      [
        "Invalides",
        396
      ],
      [
        "Saint-Martin d'Étampes",
        149
      ],
      [
        "Massy - Palaiseau",
        137
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Bibliothèque François Mitterrand",
        54
      ],
      [
        "Dourdan",
        48
      ],
      [
        "Brétigny",
        36
      ]
    ]
  },
  "spine:19": {
    "A": [
      [
        "Montigny - Beauchamp",
        287
      ],
      [
        "Pontoise",
        270
      ]
    ],
    "B": [
      [
        "Invalides",
        216
      ],
      [
        "Massy - Palaiseau",
        137
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Brétigny",
        36
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:18": {
    "A": [
      [
        "Montigny - Beauchamp",
        287
      ],
      [
        "Pontoise",
        270
      ]
    ],
    "B": [
      [
        "Invalides",
        216
      ],
      [
        "Massy - Palaiseau",
        137
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Brétigny",
        36
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:17": {
    "A": [
      [
        "Montigny - Beauchamp",
        302
      ],
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Invalides",
        216
      ],
      [
        "Massy - Palaiseau",
        137
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Brétigny",
        36
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:16": {
    "A": [
      [
        "Montigny - Beauchamp",
        302
      ],
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Invalides",
        216
      ],
      [
        "Massy - Palaiseau",
        137
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Brétigny",
        36
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Avenue Henri Martin",
        33
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:15": {
    "A": [
      [
        "Montigny - Beauchamp",
        302
      ],
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Invalides",
        216
      ],
      [
        "Massy - Palaiseau",
        137
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Brétigny",
        36
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Avenue Henri Martin",
        33
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:14": {
    "A": [
      [
        "Montigny - Beauchamp",
        302
      ],
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Invalides",
        216
      ],
      [
        "Massy - Palaiseau",
        137
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Brétigny",
        36
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Avenue Henri Martin",
        33
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:13": {
    "A": [
      [
        "Montigny - Beauchamp",
        302
      ],
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Invalides",
        216
      ],
      [
        "Massy - Palaiseau",
        137
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Brétigny",
        36
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Avenue Henri Martin",
        33
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:12": {
    "A": [
      [
        "Montigny - Beauchamp",
        302
      ],
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Invalides",
        216
      ],
      [
        "Massy - Palaiseau",
        137
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Avenue Henri Martin",
        33
      ],
      [
        "Brétigny",
        28
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:11": {
    "A": [
      [
        "Montigny - Beauchamp",
        302
      ],
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Invalides",
        216
      ],
      [
        "Massy - Palaiseau",
        137
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Avenue Henri Martin",
        33
      ],
      [
        "Brétigny",
        28
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:10": {
    "A": [
      [
        "Montigny - Beauchamp",
        302
      ],
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Invalides",
        216
      ],
      [
        "Massy - Palaiseau",
        137
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Avenue Henri Martin",
        33
      ],
      [
        "Brétigny",
        28
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:9": {
    "A": [
      [
        "Montigny - Beauchamp",
        302
      ],
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Invalides",
        216
      ],
      [
        "Massy - Palaiseau",
        136
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Avenue Henri Martin",
        33
      ],
      [
        "Brétigny",
        28
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:8": {
    "A": [
      [
        "Montigny - Beauchamp",
        302
      ],
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Invalides",
        216
      ],
      [
        "Massy - Palaiseau",
        136
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Avenue Henri Martin",
        33
      ],
      [
        "Brétigny",
        28
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:7": {
    "A": [
      [
        "Montigny - Beauchamp",
        302
      ],
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Invalides",
        216
      ],
      [
        "Massy - Palaiseau",
        136
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Avenue Henri Martin",
        33
      ],
      [
        "Brétigny",
        28
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:6": {
    "A": [
      [
        "Montigny - Beauchamp",
        302
      ],
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Invalides",
        216
      ],
      [
        "Massy - Palaiseau",
        135
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Avenue Henri Martin",
        33
      ],
      [
        "Brétigny",
        28
      ],
      [
        "Ermont - Eaubonne",
        2
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:5": {
    "A": [
      [
        "Montigny - Beauchamp",
        302
      ],
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Invalides",
        216
      ],
      [
        "Massy - Palaiseau",
        135
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Avenue Henri Martin",
        33
      ],
      [
        "Brétigny",
        28
      ],
      [
        "Ermont - Eaubonne",
        2
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spur:0": {
    "A": [],
    "B": [
      [
        "Juvisy",
        511
      ],
      [
        "Invalides",
        81
      ],
      [
        "Javel",
        4
      ]
    ]
  },
  "west:3": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        589
      ]
    ],
    "B": [
      [
        "Juvisy",
        511
      ],
      [
        "Invalides",
        81
      ],
      [
        "Javel",
        4
      ]
    ]
  },
  "west:4": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        589
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        289
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Juvisy",
        511
      ],
      [
        "Invalides",
        180
      ],
      [
        "Saint-Martin d'Étampes",
        112
      ],
      [
        "Dourdan",
        48
      ],
      [
        "Dourdan la Forêt",
        27
      ],
      [
        "Gare d'Austerlitz",
        8
      ],
      [
        "Javel",
        4
      ]
    ]
  },
  "west:5": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        589
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        289
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Juvisy",
        511
      ],
      [
        "Invalides",
        180
      ],
      [
        "Saint-Martin d'Étampes",
        149
      ],
      [
        "Dourdan",
        48
      ],
      [
        "Dourdan la Forêt",
        28
      ],
      [
        "Bibliothèque François Mitterrand",
        19
      ],
      [
        "Gare d'Austerlitz",
        9
      ],
      [
        "Javel",
        4
      ]
    ]
  },
  "west:6": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        589
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        289
      ],
      [
        "Chaville - Vélizy",
        56
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Juvisy",
        511
      ],
      [
        "Invalides",
        180
      ],
      [
        "Saint-Martin d'Étampes",
        149
      ],
      [
        "Dourdan",
        48
      ],
      [
        "Dourdan la Forêt",
        28
      ],
      [
        "Bibliothèque François Mitterrand",
        19
      ],
      [
        "Gare d'Austerlitz",
        9
      ],
      [
        "Javel",
        4
      ]
    ]
  },
  "west:7": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        589
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        289
      ],
      [
        "Chaville - Vélizy",
        56
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Juvisy",
        511
      ],
      [
        "Invalides",
        180
      ],
      [
        "Saint-Martin d'Étampes",
        149
      ],
      [
        "Dourdan",
        48
      ],
      [
        "Dourdan la Forêt",
        28
      ],
      [
        "Bibliothèque François Mitterrand",
        19
      ],
      [
        "Gare d'Austerlitz",
        9
      ],
      [
        "Javel",
        4
      ]
    ]
  },
  "west:8": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        589
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        289
      ],
      [
        "Chaville - Vélizy",
        56
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Juvisy",
        511
      ],
      [
        "Invalides",
        180
      ],
      [
        "Saint-Martin d'Étampes",
        149
      ],
      [
        "Dourdan",
        48
      ],
      [
        "Dourdan la Forêt",
        28
      ],
      [
        "Bibliothèque François Mitterrand",
        19
      ],
      [
        "Gare d'Austerlitz",
        9
      ],
      [
        "Javel",
        4
      ]
    ]
  },
  "west:9": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        589
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        289
      ],
      [
        "Chaville - Vélizy",
        56
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Juvisy",
        511
      ],
      [
        "Invalides",
        180
      ],
      [
        "Saint-Martin d'Étampes",
        149
      ],
      [
        "Dourdan",
        48
      ],
      [
        "Dourdan la Forêt",
        28
      ],
      [
        "Bibliothèque François Mitterrand",
        19
      ],
      [
        "Gare d'Austerlitz",
        9
      ],
      [
        "Javel",
        4
      ]
    ]
  },
  "west:10": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        589
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        289
      ],
      [
        "Chaville - Vélizy",
        56
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Juvisy",
        511
      ],
      [
        "Invalides",
        180
      ],
      [
        "Saint-Martin d'Étampes",
        149
      ],
      [
        "Dourdan",
        48
      ],
      [
        "Dourdan la Forêt",
        28
      ],
      [
        "Bibliothèque François Mitterrand",
        19
      ],
      [
        "Gare d'Austerlitz",
        9
      ]
    ]
  },
  "spine:31": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        468
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        32
      ],
      [
        "Pontoise",
        4
      ]
    ],
    "B": [
      [
        "Juvisy",
        509
      ]
    ]
  },
  "spine:32": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        468
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        32
      ],
      [
        "Pontoise",
        4
      ]
    ],
    "B": [
      [
        "Juvisy",
        509
      ]
    ]
  },
  "spine:33": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        468
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        32
      ],
      [
        "Pontoise",
        4
      ]
    ],
    "B": [
      [
        "Juvisy",
        509
      ]
    ]
  },
  "orly:6": {
    "A": [
      [
        "Pontoise",
        121
      ],
      [
        "Gare d'Austerlitz",
        98
      ],
      [
        "Montigny - Beauchamp",
        16
      ]
    ],
    "B": []
  },
  "orly:5": {
    "A": [
      [
        "Pontoise",
        121
      ],
      [
        "Gare d'Austerlitz",
        98
      ],
      [
        "Montigny - Beauchamp",
        16
      ]
    ],
    "B": [
      [
        "Massy - Palaiseau",
        237
      ]
    ]
  },
  "orly:3": {
    "A": [
      [
        "Pontoise",
        121
      ],
      [
        "Gare d'Austerlitz",
        98
      ],
      [
        "Montigny - Beauchamp",
        16
      ]
    ],
    "B": [
      [
        "Massy - Palaiseau",
        237
      ]
    ]
  },
  "orly:2": {
    "A": [
      [
        "Pontoise",
        121
      ],
      [
        "Gare d'Austerlitz",
        98
      ],
      [
        "Montigny - Beauchamp",
        16
      ]
    ],
    "B": [
      [
        "Massy - Palaiseau",
        237
      ]
    ]
  },
  "spine:4": {
    "A": [
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Invalides",
        216
      ],
      [
        "Massy - Palaiseau",
        135
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        134
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Avenue Henri Martin",
        33
      ],
      [
        "Brétigny",
        28
      ],
      [
        "Ermont - Eaubonne",
        2
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:3": {
    "A": [
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Massy - Palaiseau",
        120
      ],
      [
        "Invalides",
        104
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        17
      ],
      [
        "Avenue Henri Martin",
        17
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:2": {
    "A": [
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Massy - Palaiseau",
        120
      ],
      [
        "Invalides",
        104
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        17
      ],
      [
        "Avenue Henri Martin",
        17
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "spine:1": {
    "A": [
      [
        "Pontoise",
        274
      ]
    ],
    "B": [
      [
        "Massy - Palaiseau",
        120
      ],
      [
        "Invalides",
        104
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        17
      ],
      [
        "Avenue Henri Martin",
        17
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  },
  "etampes:6": {
    "A": [
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        122
      ],
      [
        "Musée d'Orsay",
        106
      ],
      [
        "Juvisy",
        42
      ],
      [
        "Versailles Château Rive Gauche",
        36
      ],
      [
        "Gare d'Austerlitz",
        1
      ],
      [
        "Chaville - Vélizy",
        1
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": []
  },
  "etampes:5": {
    "A": [
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        122
      ],
      [
        "Musée d'Orsay",
        106
      ],
      [
        "Juvisy",
        42
      ],
      [
        "Versailles Château Rive Gauche",
        36
      ],
      [
        "Gare d'Austerlitz",
        1
      ],
      [
        "Chaville - Vélizy",
        1
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Saint-Martin d'Étampes",
        336
      ]
    ]
  },
  "etampes:4": {
    "A": [
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        122
      ],
      [
        "Musée d'Orsay",
        106
      ],
      [
        "Juvisy",
        42
      ],
      [
        "Versailles Château Rive Gauche",
        36
      ],
      [
        "Gare d'Austerlitz",
        1
      ],
      [
        "Chaville - Vélizy",
        1
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Saint-Martin d'Étampes",
        335
      ]
    ]
  },
  "etampes:3": {
    "A": [
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        122
      ],
      [
        "Musée d'Orsay",
        106
      ],
      [
        "Juvisy",
        42
      ],
      [
        "Versailles Château Rive Gauche",
        36
      ],
      [
        "Gare d'Austerlitz",
        1
      ],
      [
        "Chaville - Vélizy",
        1
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Saint-Martin d'Étampes",
        335
      ]
    ]
  },
  "etampes:2": {
    "A": [
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        122
      ],
      [
        "Musée d'Orsay",
        106
      ],
      [
        "Juvisy",
        42
      ],
      [
        "Versailles Château Rive Gauche",
        36
      ],
      [
        "Gare d'Austerlitz",
        1
      ],
      [
        "Chaville - Vélizy",
        1
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Saint-Martin d'Étampes",
        335
      ]
    ]
  },
  "etampes:1": {
    "A": [
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        122
      ],
      [
        "Musée d'Orsay",
        106
      ],
      [
        "Juvisy",
        42
      ],
      [
        "Versailles Château Rive Gauche",
        36
      ],
      [
        "Gare d'Austerlitz",
        1
      ],
      [
        "Chaville - Vélizy",
        1
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Saint-Martin d'Étampes",
        336
      ]
    ]
  },
  "etampes:0": {
    "A": [
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        122
      ],
      [
        "Musée d'Orsay",
        106
      ],
      [
        "Juvisy",
        42
      ],
      [
        "Versailles Château Rive Gauche",
        36
      ],
      [
        "Gare d'Austerlitz",
        1
      ],
      [
        "Chaville - Vélizy",
        1
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Saint-Martin d'Étampes",
        335
      ]
    ]
  },
  "spine:39": {
    "A": [
      [
        "Musée d'Orsay",
        218
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        154
      ],
      [
        "Invalides",
        99
      ],
      [
        "Juvisy",
        93
      ],
      [
        "Gare d'Austerlitz",
        48
      ],
      [
        "Versailles Château Rive Gauche",
        36
      ],
      [
        "Chaville - Vélizy",
        32
      ],
      [
        "Pontoise",
        28
      ]
    ],
    "B": [
      [
        "Saint-Martin d'Étampes",
        336
      ],
      [
        "Dourdan",
        197
      ],
      [
        "Dourdan la Forêt",
        131
      ]
    ]
  },
  "spine:38": {
    "A": [
      [
        "Musée d'Orsay",
        218
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        142
      ],
      [
        "Invalides",
        99
      ],
      [
        "Juvisy",
        93
      ],
      [
        "Pontoise",
        28
      ],
      [
        "Gare d'Austerlitz",
        23
      ],
      [
        "Chaville - Vélizy",
        5
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Saint-Martin d'Étampes",
        294
      ],
      [
        "Dourdan",
        148
      ],
      [
        "Dourdan la Forêt",
        131
      ],
      [
        "Brétigny",
        70
      ]
    ]
  },
  "spine:37": {
    "A": [
      [
        "Musée d'Orsay",
        218
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        142
      ],
      [
        "Invalides",
        99
      ],
      [
        "Juvisy",
        93
      ],
      [
        "Pontoise",
        28
      ],
      [
        "Gare d'Austerlitz",
        23
      ],
      [
        "Chaville - Vélizy",
        5
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Saint-Martin d'Étampes",
        294
      ],
      [
        "Dourdan",
        148
      ],
      [
        "Dourdan la Forêt",
        131
      ],
      [
        "Brétigny",
        70
      ]
    ]
  },
  "spine:36": {
    "A": [
      [
        "Musée d'Orsay",
        218
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        146
      ],
      [
        "Invalides",
        99
      ],
      [
        "Juvisy",
        93
      ],
      [
        "Chaville - Vélizy",
        32
      ],
      [
        "Pontoise",
        28
      ],
      [
        "Gare d'Austerlitz",
        23
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Saint-Martin d'Étampes",
        294
      ],
      [
        "Dourdan",
        148
      ],
      [
        "Dourdan la Forêt",
        131
      ],
      [
        "Brétigny",
        70
      ]
    ]
  },
  "spine:35": {
    "A": [
      [
        "Musée d'Orsay",
        218
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        146
      ],
      [
        "Invalides",
        99
      ],
      [
        "Juvisy",
        93
      ],
      [
        "Chaville - Vélizy",
        32
      ],
      [
        "Pontoise",
        28
      ],
      [
        "Gare d'Austerlitz",
        23
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Saint-Martin d'Étampes",
        294
      ],
      [
        "Dourdan",
        148
      ],
      [
        "Dourdan la Forêt",
        131
      ],
      [
        "Brétigny",
        70
      ]
    ]
  },
  "spine:34": {
    "A": [
      [
        "Versailles Château Rive Gauche",
        520
      ],
      [
        "Musée d'Orsay",
        218
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        186
      ],
      [
        "Invalides",
        99
      ],
      [
        "Gare d'Austerlitz",
        48
      ],
      [
        "Chaville - Vélizy",
        32
      ],
      [
        "Pontoise",
        32
      ],
      [
        "Versailles Chantiers",
        1
      ]
    ],
    "B": [
      [
        "Saint-Martin d'Étampes",
        335
      ],
      [
        "Dourdan",
        196
      ],
      [
        "Dourdan la Forêt",
        131
      ],
      [
        "Brétigny",
        70
      ]
    ]
  },
  "west:2": {
    "A": [
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        289
      ]
    ],
    "B": [
      [
        "Saint-Martin d'Étampes",
        112
      ],
      [
        "Invalides",
        99
      ],
      [
        "Dourdan",
        48
      ],
      [
        "Dourdan la Forêt",
        27
      ],
      [
        "Gare d'Austerlitz",
        8
      ]
    ]
  },
  "west:1": {
    "A": [
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        289
      ]
    ],
    "B": [
      [
        "Saint-Martin d'Étampes",
        112
      ],
      [
        "Invalides",
        99
      ],
      [
        "Dourdan",
        48
      ],
      [
        "Dourdan la Forêt",
        27
      ],
      [
        "Gare d'Austerlitz",
        8
      ]
    ]
  },
  "dourdan:7": {
    "A": [
      [
        "Musée d'Orsay",
        112
      ],
      [
        "Invalides",
        87
      ],
      [
        "Juvisy",
        51
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        32
      ],
      [
        "Chaville - Vélizy",
        31
      ],
      [
        "Pontoise",
        8
      ],
      [
        "Gare d'Austerlitz",
        6
      ]
    ],
    "B": [
      [
        "Dourdan la Forêt",
        131
      ]
    ]
  },
  "dourdan:6": {
    "A": [
      [
        "Musée d'Orsay",
        112
      ],
      [
        "Invalides",
        87
      ],
      [
        "Juvisy",
        51
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        32
      ],
      [
        "Chaville - Vélizy",
        31
      ],
      [
        "Pontoise",
        8
      ],
      [
        "Gare d'Austerlitz",
        6
      ]
    ],
    "B": [
      [
        "Dourdan",
        196
      ],
      [
        "Dourdan la Forêt",
        131
      ]
    ]
  },
  "dourdan:5": {
    "A": [
      [
        "Musée d'Orsay",
        112
      ],
      [
        "Invalides",
        87
      ],
      [
        "Juvisy",
        51
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        32
      ],
      [
        "Chaville - Vélizy",
        31
      ],
      [
        "Pontoise",
        8
      ],
      [
        "Gare d'Austerlitz",
        6
      ]
    ],
    "B": [
      [
        "Dourdan",
        196
      ],
      [
        "Dourdan la Forêt",
        131
      ]
    ]
  },
  "dourdan:4": {
    "A": [
      [
        "Musée d'Orsay",
        112
      ],
      [
        "Invalides",
        87
      ],
      [
        "Juvisy",
        51
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        32
      ],
      [
        "Chaville - Vélizy",
        31
      ],
      [
        "Pontoise",
        8
      ],
      [
        "Gare d'Austerlitz",
        6
      ]
    ],
    "B": [
      [
        "Dourdan",
        196
      ],
      [
        "Dourdan la Forêt",
        131
      ]
    ]
  },
  "dourdan:3": {
    "A": [
      [
        "Musée d'Orsay",
        112
      ],
      [
        "Invalides",
        87
      ],
      [
        "Juvisy",
        51
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        32
      ],
      [
        "Chaville - Vélizy",
        31
      ],
      [
        "Pontoise",
        8
      ],
      [
        "Gare d'Austerlitz",
        6
      ]
    ],
    "B": [
      [
        "Dourdan",
        196
      ],
      [
        "Dourdan la Forêt",
        131
      ]
    ]
  },
  "dourdan:2": {
    "A": [
      [
        "Musée d'Orsay",
        112
      ],
      [
        "Invalides",
        87
      ],
      [
        "Juvisy",
        51
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        32
      ],
      [
        "Chaville - Vélizy",
        31
      ],
      [
        "Pontoise",
        8
      ],
      [
        "Gare d'Austerlitz",
        6
      ]
    ],
    "B": [
      [
        "Dourdan",
        196
      ],
      [
        "Dourdan la Forêt",
        131
      ]
    ]
  },
  "dourdan:1": {
    "A": [
      [
        "Musée d'Orsay",
        112
      ],
      [
        "Invalides",
        87
      ],
      [
        "Juvisy",
        51
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        32
      ],
      [
        "Chaville - Vélizy",
        31
      ],
      [
        "Pontoise",
        8
      ],
      [
        "Gare d'Austerlitz",
        6
      ]
    ],
    "B": [
      [
        "Dourdan",
        197
      ],
      [
        "Dourdan la Forêt",
        131
      ]
    ]
  },
  "dourdan:0": {
    "A": [
      [
        "Musée d'Orsay",
        112
      ],
      [
        "Invalides",
        87
      ],
      [
        "Juvisy",
        51
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        32
      ],
      [
        "Chaville - Vélizy",
        31
      ],
      [
        "Pontoise",
        8
      ],
      [
        "Gare d'Austerlitz",
        6
      ]
    ],
    "B": [
      [
        "Dourdan",
        196
      ],
      [
        "Dourdan la Forêt",
        131
      ]
    ]
  },
  "dourdan:8": {
    "A": [
      [
        "Invalides",
        48
      ],
      [
        "Musée d'Orsay",
        36
      ],
      [
        "Saint-Quentin en Yvelines - Montigny-le-Bretonneux",
        28
      ],
      [
        "Juvisy",
        18
      ]
    ],
    "B": []
  },
  "orly:1": {
    "A": [
      [
        "Pont de Rungis Aéroport d'Orly",
        266
      ],
      [
        "Pontoise",
        78
      ],
      [
        "Montigny - Beauchamp",
        77
      ],
      [
        "Gare d'Austerlitz",
        74
      ]
    ],
    "B": [
      [
        "Massy - Palaiseau",
        237
      ]
    ]
  },
  "west:0": {
    "A": [],
    "B": [
      [
        "Saint-Martin d'Étampes",
        112
      ],
      [
        "Invalides",
        99
      ],
      [
        "Dourdan",
        48
      ],
      [
        "Dourdan la Forêt",
        27
      ],
      [
        "Gare d'Austerlitz",
        8
      ]
    ]
  },
  "spine:0": {
    "A": [],
    "B": [
      [
        "Massy - Palaiseau",
        120
      ],
      [
        "Invalides",
        104
      ],
      [
        "Bibliothèque François Mitterrand",
        35
      ],
      [
        "Pont de Rungis Aéroport d'Orly",
        17
      ],
      [
        "Avenue Henri Martin",
        17
      ],
      [
        "Gare d'Austerlitz",
        1
      ]
    ]
  }
};
