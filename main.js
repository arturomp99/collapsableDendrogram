// Set the dimensions and margins of the diagram
var margin = {top: 20, right: 90, bottom: 30, left: 90},
    width = window.innerWidth - margin.left - margin.right,
    height = window.innerHeight - margin.top - margin.bottom;


// Set the expand all and collapse all buttons
let expandAllBtn = document.getElementById('expandAllBtn');
expandAllBtn.addEventListener("click", ()=> {
    expandLeaves(root);
});
let collapseAllBtn = document.getElementById('collapseAllBtn');
collapseAllBtn.addEventListener("click", ()=> {
    if (root.children) {
        root.children.forEach((e)=>{
            collapse(e);
            update(e);
        });
    }
});

// TWEAKABLES ----------------------------------------
// const dataPath = "./data/CleanData_Boyaca.csv";
const dataPath = "./data/CleanData_Boyaca.csv";
var i = 0,
    duration = 750;
    r_1 = 12, r_2 = 10;
const fontSize = d3.scaleLinear();
// GENERIC -------------------------------------------
var treemap = d3.tree()
    .nodeSize([r_1, r_1])
    .separation((a,b)=>a.parent == b.parent ? 1.2 + (a.height + b.height)/2 : 1.2 + (a.height + b.height)/2 + r_1*0.1);//.size([height, width]);


var root;
// append the svg object to the body of the page
// appends a 'group' element to 'svg'
// moves the 'group' element to the top left margin
var svg1 = d3   // Separate to avoid zoom bad behavior   
    .select("#dendrogram")
    .append("svg")
        .attr("width", width + margin.right + margin.left)
        .attr("height", height + margin.top + margin.bottom)
    .append('g')        // Solución para evitar que se panee a en el primer zoomEvent. Zoom se aplica en este <g>. En el siguiente se aplican los márgenes
        .attr('class', "zoom");
let svg = svg1
    .append('g')
        .attr("transform", `translate(${margin.left},${margin.top + height / 2})`);

// Add zoom
// https://www.youtube.com/watch?v=ZNrG6sMNHeI
let zoom = d3.zoom().scaleExtent([0.5, 10])
    .on('zoom', (e) => svg1.attr('transform', e.transform));
d3.select('#dendrogram').call(zoom);

// Build an async main function ----------------------------
const main = async()=> {
    if (dataPath.includes("csv")) {
        data = await d3.csv(dataPath);

        // Turn the array into a hierarchy
        dataByTaxonomy = d3.group(data,
                                d=>d.kingdom, 
                                d=>d.phylum, 
                                d=>d.class, 
                                d=>d.order, 
                                d=>d.family, 
                                d=>d.genus); 
        root = d3.hierarchy(dataByTaxonomy);
    } else {
        data = await d3.json(dataPath)                  // Read data
        root = d3.hierarchy(data, (d)=>d.children);     // Assigns parent, children, height, depth
    }
    console.log(root);
    root.x0 = height / 2;
    root.y0 = 0;
    root.children.forEach(collapse) // Collapse after the second level

    // TODO: DATA PROCESSING
    fontSize
        .domain(d3.extent(root.each((d)=>d.depth)))   // Finds both the min and the max
        .range([18, 6]);
    
    //console.log(d3.tree.nodes(root));
    
    update(root);
}

function update(source) {
    let treeData = treemap(root); // Assigns the x and y positions for the nodes
    let nodes = treeData.descendants(), 
        links = treeData.descendants().slice(1); // Compute the new tree layout
    nodes.forEach((d)=>{d.y = d.depth * 180}); // Normalize for fixed-depth

    // ****************** Nodes section ***************************
    // Update the nodes...
    var node = svg
        .selectAll('g.node')
        .data(nodes, (d) => d.id || (d.id = ++i)); // here, if d.id exists and is truthy, just return d.id; if not, then assign d.id to ++i

    // Enter any new nodes at the parent's previous position
    var nodeEnter = node
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', `translate(${source.y0}, ${source.x0})`)
        .on('click', click);

    // Add circle as node
    nodeEnter
        .append('circle')
        .attr('class', 'node')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 1e-6)
        .style('fill', (d)=> d._children ? 'green' : 'white'); 

    // Add labels for the nodes
    nodeEnter
        .append('text')
        .attr("x", (d)=> d._children || d.children ? -r_1*1.2 : r_1*1.2)
        .attr("y", (d)=> d._children || d.children ? -r_1*0.2 : r_1*0.2)
        .attr("text-anchor", (d)=> d._children || d.children ? "end" : "start") // Different anchor for leaf nodes
        .attr('font-size', d => fontSize(d.depth) + 'px')
        .text((d)=> d.name || d.data.name || d.data[0] || d.data.scientificName);// || d.data.data.id);    // d.data.data.id es para los paises

    // UPDATE
    var nodeUpdate = nodeEnter.merge(node);

    // Transition to the proper position for the node
    nodeUpdate
        .transition()
        .duration(duration)
        .attr("transform", (d)=> {  return `translate(${d.y}, ${d.x})`; });
    
    // Transition for the circles
    nodeUpdate
        .selectAll('circle.node')
        .transition()
        .duration(duration)
        .attr('r', (d)=>d._children ? r_1 : r_2)
        .style('fill', (d)=>d._children ? 'green' : 'white');

    // Remove any existing nodes
    var nodeExit = node
        .exit()
        .transition()
        .duration(duration)
        .attr('transform', (d)=>{ return `translate(${source.y},${source.x})`; })   // (y,x) y no (source.y0, source.x0) porque source puede ser que se mueva tambien, vamos a la nueva posicion de source
        .remove();
    
    // On exit reduce the node circles size to 0
    nodeExit
        .select('rect.node')
        .attr('width', 1e-6)
        .attr('height', 1e-6);
    
    // On exit reduce the opacity of text labels
    nodeExit
        .select('text')
        .style('fill-opacity', 1e-6);

    // On exit reduce the opacity of text icon
    nodeExit
        .select('path.node')
        .style('fill-opacity', 1e-6)
        .style('stroke-opacity', 1e-6);
    

    // ****************** links section ***************************
    // Update the links...
    var link = svg.selectAll('path.link')
        .data(links, (d)=>d.id);
    
    // Enter any new links at the parent's previous position
    var linkEnter = link
        .enter()
        .insert('path', 'g')
        .attr('class', 'link')
        .attr('d', (d)=> {
            var o = {x:source.x0, y:source.y0};
            return diagonal(o,o);
    });

    // UPDATE
    var linkUpdate = linkEnter.merge(link);

    // Transition back to the parent element position
    linkUpdate
        .transition()
        .duration(duration)
        .attr('d', (d)=>diagonal(d, d.parent));

    // Remove any existing links
    var linkExit = link
        .exit()
        .transition()
        .duration(duration)
        .attr('d', (d)=> {
            var o = {x: source.x, y: source.y};
            return diagonal(o, o);
        }).remove();

    // Store the old positions for transition
    nodes.forEach(function(d){
        d.x0 = d.x;
        d.y0 = d.y;
    });

    // Creates a curved (diagonal) path from parent to the child nodes
    function diagonal(s, d) {
        path = `M${s.y} ${s.x}
                C ${(s.y + d.y) / 2} ${s.x},
                ${(s.y + d.y) / 2} ${d.x},
                ${d.y} ${d.x}`
        return path;
    }    
}

// Toggle children on click.
function click(event, d) {
    if (d.children) {
        d._children = d.children;
        d.children = null;
    } else {
        d.children = d._children;
        d._children = null;
    }
update(d);
}

// Collapse the node and all its children
function collapse(d) {
    if (d.children) {   // If it has children
        d._children = d.children;   // Set them as collapsed
        d.children.forEach(collapse);   // Check if the children have children of their own
        d.children = null;
    }
}

function expandLeaves(r) {
    if (r._children) {
        expandAll(r);
        update(r);
    } else if (r.children) {
        r.children.forEach((e)=>expandLeaves(e));
    }
}

function expandAll(r) { // We suppose r has r._children and no r.children
    if (r._children) {
        r.children = r._children;
        r._children = null;
        r.children.forEach((e)=>expandAll(e));
    }
}

main();