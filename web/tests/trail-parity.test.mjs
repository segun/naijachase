import test from "node:test";
import assert from "node:assert/strict";
import { activity, caseFile, controller, deferred } from "./controller-runtime.mjs";
import { questionedHere } from "../src/domain/model.ts";

for (const kind of ["ordinary", "replay"]) {
  for (const withEvents of [true, false]) {
    test(`${kind}: wrong destination, three neutral interviews, reload, and recovery (${withEvents ? "travel events" : "state-only feedback"})`, async () => {
      const app = controller();
      let server = caseFile("trail-case", { attempt_kind: kind });
      app.applyActivity(activity(kind === "ordinary" ? server : null, kind === "replay" ? [server] : []));
      app.game = server; app.caseId = server.case_id;
      const coldReplies = {
        market: "I am sorry, but I have not seen anyone matching that description.",
        library: "I have not heard anything that could help you.",
        motor_park: "No one matching that description has passed through here today."
      };
      app.api.command = async (id, version, command) => {
        assert.equal(id, server.case_id);
        assert.equal(version, server.state_version);
        const state = { ...server.state };
        let events = [];
        if (command.type === "travel") {
          state.current_state = command.destination;
          state.trail_status = command.destination === "Oyo" ? "hot" : "cold";
          if (state.trail_status === "hot") state.stage++;
          if (withEvents) events = [{ event_type: state.trail_status === "hot" ? "arrived_on_trail" : "false_destination", data: { trail_status: state.trail_status } }];
        } else {
          state.visited_venues = [...state.visited_venues, `${state.stage}|${state.current_state}|${command.venue_id}`];
          events = [{ event_type: "witness_account", data: {
            message: state.trail_status === "hot" ? "The suspect asked for the road to Oyo." : coldReplies[command.venue_id],
            trail_status: state.trail_status, venue_name: command.venue_id,
            local_venue_name: `${state.current_state} ${command.venue_id}`, witness_role: "Witness"
          } }];
        }

        server = { ...server, state_version: version + 1, state, events };
        return server;
      };
      await app.command({ type: "visit_venue", venue_id: "market", mode: "drive" }, "Interviewed");
      assert.match(app.lastWitness.message, /road to Oyo/);
      assert.equal(await app.command({ type: "travel", destination: "Sokoto", mode: "drive" }, "Arrived"), true);
      assert.equal(app.game.state.current_state, "Sokoto");
      assert.equal(app.game.state.stage, 0);
      assert.equal(app.game.state.trail_status, "cold");
      assert.equal(app.toasts.at(-1).text, "The trail has gone cold.");
      assert.equal(app.toasts.at(-1).kind, "error");
      assert.equal(app.lastWitness, null);
      assert.equal(app.witnessVisit, null);
      assert.deepEqual(questionedHere(app.game.state), []);
      for (const [venue, message] of Object.entries(coldReplies)) {
        assert.equal(await app.command({ type: "visit_venue", venue_id: venue, mode: "drive" }, "Interviewed"), true);
        assert.equal(app.lastWitness.message, message);
        assert.equal(app.lastWitness.venueName, `Sokoto ${venue}`);
        await app.arriveAtWitness("drive");
        assert.equal(app.witnessVisit.message, message);
        app.leaveWitness();
        assert.deepEqual(app.notes.at(-1), { stop: "Sokoto", venue, message });
      }
      assert.equal(questionedHere(app.game.state).length, 3);
      assert.equal(app.notes.filter(n => n.stop === "Sokoto").length, 3);
      assert.match(app.notes.find(n => n.stop === "Lagos").message, /road to Oyo/);
      assert.equal(JSON.parse(sessionStorage.getItem("nc-notes")).at(-1).stop, "Sokoto");
      app.api.load = async () => ({ ...server, events: [] });
      await app.resume();
      assert.equal(app.game.state.trail_status, "cold");
      assert.equal(await app.command({ type: "travel", destination: "Oyo", mode: "drive" }, "Arrived"), true);
      assert.equal(app.game.state.trail_status, "hot");
      assert.equal(app.game.state.stage, 1);
      assert.equal(app.toasts.at(-1).text, "The trail is hot.");
      assert.equal(app.toasts.at(-1).kind, "success");
      assert.deepEqual(questionedHere(app.game.state), []);
    });
  }
}

test("travel removes the previous location's leads while the new quotes are loading", async () => {
  const app = controller(), loading = deferred(), initial = caseFile();
  app.applyActivity(activity(initial));
  app.quotes = [{ scope: "local", destination_id: "market", label: "Lagos market" }];
  app.quotesLoaded = true;
  app.lastWitness = { venueId: "market", message: "Old Lagos clue" };
  app.witnessVisit = { ...app.lastWitness, arrival: "drive" };
  app.api.quotes = () => loading.promise;
  app.api.command = async () => ({
    ...initial, state_version: 2,
    state: { ...initial.state, current_state: "Sokoto", trail_status: "cold" }
  });
  assert.equal(await app.command({ type: "travel", destination: "Sokoto", mode: "drive" }, "Arrived"), true);
  assert.deepEqual(app.quotes, []);
  assert.equal(app.quotesLoaded, false);
  assert.equal(app.lastWitness, null);
  assert.equal(app.witnessVisit, null);
  const quotes = [{ scope: "local", destination_id: "library", label: "Sokoto library" }];
  loading.resolve(quotes);
  await loading.promise;
  assert.deepEqual(app.quotes, quotes);
  assert.equal(app.quotesLoaded, true);
});
