// OLD ADD OBSERVER

const c: Computation<unknown, unknown> = new Proxy(
  {
    fn,
    state: 1,
    updatedAt: null,
    owned: null,
    name: "$slugger-comp" + Math.random(),
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: o.value,
    owner: OWNER,
    context: null,
    pure: true
  },
  {
    get: (a, b, c) => {
      console.log("get", b, a[b]);
      return a[b];
    },
    set: (a, b, c) => {
      console.log("set", b, a[b], c);
      a[b] = c;
      return true;
    }
  }
);
// @ts-expect-error
if (Array.isArray(o.observers)) o.observers.push(c);
// @ts-expect-error
o.observers = [c];

const formatter = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
const formatArray = (list: any[]): string => formatter.format(list);

const guardians: Owner[] = [];
let addOwnerGuardianRuns = 0;
const addOwnerGuardian = (o: Owner) => {
  addOwnerGuardianRuns++;
  const indexOfCleanedUpOwner = guardians.indexOf(o);
  if (indexOfCleanedUpOwner !== -1) {
    guardians.splice(indexOfCleanedUpOwner, 1);
  }
  const owner = o.owner;
  if (!owner) return;
  if (!guardians.includes(owner)) guardians.push(owner);
  queueMicrotask(() => {
    if (--addOwnerGuardianRuns > 0) return;
    console.log("GUARDIANS:", formatArray(guardians.map(o => getComponentName(o))));
    guardians.forEach(o => {
      if (!o.sourceMap) return;
      Object.entries(o.sourceMap).forEach(([key, v]) => {
        addObserver(v, () => console.log("GUARDIAN OBSERVED CHANGE", key));
      });

      // addObserver(o, () => console.log("GUARDIAN OBSERVED CHANGE"));
    });
  });
};

const loop = (owner: Owner | null) => {
  if (!owner) return console.log("END");
  const { componentName, owned, sourceMap } = owner;
  if (componentName) console.log("name", getComponentName(owner));

  addCleanupFn(owner, () => {
    console.log("owner cleanup", getComponentName(owner));
    addOwnerGuardian(owner);
  });

  if (sourceMap) {
    console.log("sourceMap:");
    Object.entries(sourceMap).forEach(([key, v]) => {
      const state = v as SignalState<unknown>;
      console.log(key, "--", state);
      addObserver(state, () => {
        console.log(">>", key, state.value);
        state.observers?.forEach(comp => {
          if (comp.name?.startsWith("$slugger")) return;
          comp.owner && loopOwned(comp.owner);
        });
      });
    });
  }

  if (owned) {
    owned.forEach(owner => loop(owner));
    return;
  }
  console.log("END 2");
};
