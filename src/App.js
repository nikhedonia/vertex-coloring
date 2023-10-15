import React, { useRef, useState } from "react";
import Graph from "react-graph-vis";

const { mapValues, groupBy } = require("lodash");


const palette = [
  "#F0F8FF",
  "#FAEBD7",
  "#00FFFF",
  "#7FFFD4",
  "#F0FFFF",
  "#F5F5DC",
  "#FFE4C4",
  "#000000",
  "#FFEBCD",
  "#0000FF",
  "#8A2BE2",
  "#A52A2A",
  "#DEB887",
  "#5F9EA0",
  "#7FFF00",
  "#D2691E",
  "#FF7F50",
  "#6495ED",
  "#FFF8DC",
  "#DC143C",
  "#00FFFF",
  "#00008B",
  "#008B8B",
  "#B8860B",
  "#A9A9A9",
  "#A9A9A9",
  "#006400",
  "#BDB76B",
  "#8B008B",
  "#556B2F",
  "#FF8C00",
  "#9932CC",
  "#8B0000",
  "#E9967A",
  "#8FBC8F",
  "#483D8B",
  "#2F4F4F",
  "#2F4F4F",
  "#00CED1",
  "#9400D3",
  "#FF1493",
  "#00BFFF",
  "#696969",
  "#696969",
  "#1E90FF",
  "#B22222",
  "#FFFAF0",
  "#228B22",
  "#FF00FF",
  "#DCDCDC",
  "#F8F8FF",
  "#FFD700",
  "#DAA520",
  "#808080",
  "#808080",
  "#008000",
  "#ADFF2F",
  "#F0FFF0",
  "#FF69B4",
  "#CD5C5C",
  "#4B0082",
  "#FFFFF0",
  "#F0E68C",
  "#E6E6FA",
  "#FFF0F5",
  "#7CFC00",
  "#FFFACD",
  "#ADD8E6",
  "#F08080",
  "#E0FFFF",
  "#FAFAD2",
  "#D3D3D3",
  "#D3D3D3",
  "#90EE90",
  "#FFB6C1",
  "#FFA07A",
  "#20B2AA",
  "#87CEFA",
  "#778899",
  "#778899",
  "#B0C4DE",
  "#FFFFE0",
  "#00FF00",
  "#32CD32",
  "#FAF0E6",
  "#FF00FF",
  "#800000",
  "#66CDAA",
  "#0000CD",
  "#BA55D3",
  "#9370DB",
  "#3CB371",
  "#7B68EE",
  "#00FA9A",
  "#48D1CC",
  "#C71585",
  "#191970",
  "#F5FFFA",
  "#FFE4E1",
  "#FFE4B5",
  "#FFDEAD",
  "#000080",
  "#FDF5E6",
  "#808000",
  "#6B8E23",
  "#FFA500",
  "#FF4500",
  "#DA70D6",
  "#EEE8AA",
  "#98FB98",
  "#AFEEEE",
  "#DB7093",
  "#FFEFD5",
  "#FFDAB9",
  "#CD853F",
  "#FFC0CB",
  "#DDA0DD",
  "#B0E0E6",
  "#800080",
  "#663399",
  "#FF0000",
  "#BC8F8F",
  "#4169E1",
  "#8B4513",
  "#FA8072",
  "#F4A460",
  "#2E8B57",
  "#FFF5EE",
  "#A0522D",
  "#C0C0C0",
  "#87CEEB",
  "#6A5ACD",
  "#708090",
  "#708090",
  "#FFFAFA",
  "#00FF7F",
  "#4682B4",
  "#D2B48C",
  "#008080",
  "#D8BFD8",
  "#FF6347",
  "#40E0D0",
  "#EE82EE",
  "#F5DEB3",
  "#FFFFFF",
  "#F5F5F5",
  "#FFFF00",
  "#9ACD32"
]


const computeAllocations = (nodes) => {

    const io = nodes.map( (n, index) => {
      const output = n.output;
      return {output, inputs: n.inputs, index};
    });
  
    const outputs = Object.fromEntries(
      io.map(x => [x.output, x])
    )

    const lifetimes = mapValues(groupBy(
      io.flatMap( ({output, inputs, index}) => 
        inputs.map(input => ({input, output, index}))
      ), 'input'
    ), xs => xs.reduce( (a,b) => Math.max(a, b.index), 0))
  
    // bottleneck: 
    // the operation that uses the most amount of buffers
    const minBufferCount = Object
      .values(outputs)
      .map(x => x.inputs.length)
      .reduce((a, b) => Math.max(a, b), 0) + 1;
  
    // how many buffers can we occupy
    const maxBufferCount = Object
      .values(outputs)
      .length + minBufferCount - 1;
  
    const allocations = {}
    let binding = 0;
    let bound = [];
  
    io.forEach( (x, index) => {

      const reusable = bound
        .filter(x => x.lifetime < index)
        .sort( (a,b) => b.index - a.index) // prefer using most recently used buffer
        .map(x => x.binding);

      console.log({index, bound, reusable});

      const next = reusable.at(0) ?? binding;
      bound[next] = {
        output: x.output,
        index, 
        binding: next, 
        lifetime: lifetimes[x.output] ?? Infinity
      };

      allocations[x.output]  = {
        output: x.output,
        binding:next, 
        index,
        lifetime: lifetimes[x.output]
      };
      
      if (next == binding) {
        binding++;
      }
    });
    
    return {
      allocations,
      minBufferCount,
      maxBufferCount,
      lifetimes
    };
}

const topologicalSort = (nodes) => {
  const io = nodes.map( (n, index) => {
    const output = n.output;
    return {output, inputs: n.inputs, index};
  });

  const outputs = Object.fromEntries(
    io.map(x => [x.output, x.inputs])
  )

  const dependencyList = new Set(io.flatMap(x=>x.inputs))

  const roots = io.filter(x => !dependencyList.has(x.output))

  const sort = function* (nodes, visited={}) {
    for (const node of nodes) {
      if (!visited[node]) {
        visited[node] = 1;
        yield* sort(outputs[node], visited);
        yield node;
      } else { 
        visited[node]++;
      }
    }
  }

  const visited = {};
  return [
    ...sort(roots.map(x=>x.output), visited)
  ].map(x => ({output: x, inputs: outputs[x]}));
}

function getNodesEdges(io, allocations) {

  const nodes = io.map( (n, i) => ({id: n.output, label: n.output, color: palette[allocations[n.output].binding]}) );
  const edges = io.flatMap( n => n.inputs.map(input => ({from: input, to: n.output})))


  return {nodes, edges};

}
const g1 = [
  {output: 'a', inputs: []},
  {output: 'b', inputs: []},
  {output: 'c', inputs: ['a', 'b']},
  {output: 'd', inputs: ['c', 'b']},
  {output: 'e', inputs: ['c', 'a', 'b']},
  {output: 'f', inputs: ['e']},
  {output: 'g', inputs: ['f', 'd']},
  {output: 'h', inputs: ['e']},
];

// hack: graphvis component throws unless unmounted if data changes
let i = 0;

const options = {
  layout: {
  },
  edges: {
    color: "#000000"
  },
  height: "500px"
};

export default function App() {

  const textRef = useRef(null); 
  const [graph, setGraph] = useState(()=>getNodesEdges(g1, computeAllocations(g1).allocations));




  return (
    <div style={{display:'flex', height: '100vh', justifyContent: 'stretch'}}>
    <div style={{
      display:'flex', 
      flexDirection:'column',
      height: '100vh', justifyContent: 'stretch'
    }}>
      <textarea 
        ref={textRef}
        style={{flex: 1}}
        defaultValue={JSON.stringify(g1, null, 2)}/>
      <button onClick={()=>{
        const text = textRef.current.value;
        const json = JSON.parse(text);
        const sorted = topologicalSort(json);
        const {allocations} = computeAllocations(sorted);
        const graph = getNodesEdges(sorted, allocations);
        console.log({sorted, allocations, graph});
        setGraph(graph);

      }}>Compute Vertex Coloring</button>
    </div>
    <Graph
      key={i++}
      graph={graph}
      options={options}
      getNetwork={network => {
        //  if you want access to vis.js network api you can set the state in a parent component using this property
      }}
    />
    </div>
  );
}