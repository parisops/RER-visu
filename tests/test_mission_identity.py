"""Deux circulations peuvent partager un code mission sans suffixe visible."""
import unittest
from unittest.mock import patch
from tools import build_live_trains as builder


class MissionIdentityTests(unittest.TestCase):
    def test_same_code_keeps_distinct_journey_refs(self):
        stations = {}
        for station, minute in [('s:0', '00'), ('s:1', '10')]:
            stations[station] = {'departures': [
                {'journeyRef': journey, 'code': 'ZORU', 'dest': 'B', 'dir': 'B',
                 'scheduled': f'2026-09-05T12:{minute}:00Z',
                 'expected': f'2026-09-05T12:{minute}:00Z'}
                for journey in ('journey-1', 'journey-2')
            ]}
        data = {'generatedAt': '2026-09-05T12:05:00Z', 'stations': stations}
        with patch.object(builder, 'load_departures', return_value=data), patch.object(
            builder, 'load_route_maps', return_value=({'s': ['A', 'B']}, {'R1': {'a': 0, 'b': 10}})
        ):
            trains = builder.build_live_trains()['trains']
        self.assertEqual(len(trains), 2)
        self.assertEqual({t['journeyRef'] for t in trains}, {'journey-1', 'journey-2'})
        self.assertEqual([t['code'] for t in trains], ['ZORU', 'ZORU'])
        self.assertTrue(all(len(t['stops']) == 2 for t in trains))
        self.assertTrue(all(t['progress'] == .5 for t in trains))


if __name__ == '__main__':
    unittest.main()
