import unittest
from unittest.mock import patch
from tools import build_live_trains as builder
from tools.fetch_prim_departures import parse_departures, LINE_REF


class PipelineTests(unittest.TestCase):
    def departure(self, time, journey="journey-1"):
        payload = {"Siri": {"ServiceDelivery": {"StopMonitoringDelivery": [{
            "MonitoredStopVisit": [{"MonitoredVehicleJourney": {
                "LineRef": {"value": LINE_REF},
                "FramedVehicleJourneyRef": {"DatedVehicleJourneyRef": journey},
                "JourneyNote": [{"value": "TEST"}],
                "DestinationName": [{"value": "C"}],
                "DirectionRef": {"value": "Aller"},
                "MonitoredCall": {"AimedDepartureTime": time}
            }}]
        }]}}}
        return parse_departures(payload)[0]

    def build(self, stations):
        data = {"generatedAt": "2026-09-05T12:01:00Z", "stations": stations}
        with patch.object(builder, "load_departures", return_value=data), patch.object(
            builder, "load_route_maps", return_value=(
                {"s": ["A", "B", "C"]}, {"R1": {"a": 0, "b": 10, "c": 20}})):
            return builder.build_live_trains()["trains"]

    def test_same_journey_different_station_times_is_one_moving_train(self):
        trains = self.build({
            "s:0": {"departures": [self.departure("2026-09-05T12:00:00Z")]},
            "s:1": {"departures": [self.departure("2026-09-05T12:02:00Z")]},
        })
        self.assertEqual(len(trains), 1)
        self.assertEqual(trains[0]["journeyRef"], "journey-1")
        self.assertEqual(trains[0]["route"], "R1")
        self.assertEqual(trains[0]["progress"], .5)

    def test_missing_identifiers_fails_instead_of_publishing_broken_data(self):
        with self.assertRaises(RuntimeError):
            self.build({"s:0": {"departures": [self.departure("2026-09-05T12:00:00Z", None)]}})

    def test_single_stop_is_not_published(self):
        self.assertEqual(self.build({"s:0": {"departures": [
            self.departure("2026-09-05T12:00:00Z") ]}}), [])

    def test_destination_disambiguates_branch(self):
        result = builder.resolve_route_for_stops(
            {"s": ["A", "B"]},
            {"R1": {"a": 0, "b": 1, "x": 2}, "R2": {"a": 0, "b": 1, "c": 2}},
            [{"station": "s:0"}, {"station": "s:1"}], "C")
        self.assertEqual(result[0], "R2")


if __name__ == "__main__":
    unittest.main()
