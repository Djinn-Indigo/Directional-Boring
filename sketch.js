// Horizontal Directional Drilling Simulation
// https://thecodingtrain.com/challenges/172-directional-boring
// from The Coding Train (https://thecodingtrain.com/)
// Inspired by Practical Engineering (https://practical.engineering/)
// CT video: https://youtu.be/FfCBNL6lWK0
// Practical Engineering Video: https://youtu.be/JAhdb7dKQpU

// Play the simulator: https://codingtrain.github.io/Directional-Boring/

// Vectors for current position and direction
let pos, dir;
// Bias of current drill (up or down, 1 or -1)
let bias;
// All the points along the drill path so far
let path;
let pathPosition;
let oldPaths;
let stuckCount;
let sideTrackCount;
let startCount;
// Current state of game
let state;
let currentSeed = undefined;
let seedDiv;
// The turning radius to be computed
let turnCircleRadius;
let boulders;
let canvas;

// images of the drilling machine
let machineBack;
let machineFront;

// Groundcolor is used to determine win or lose state
const groundColor = [11, 106, 136];
const groundLevel = 100;
const boulderColor = [220, 150, 130];
const riverColor = [0, 0, 255];
const backgroundColor = [45, 197, 244];
const boundaryColor = [0, 0, 0];
// Position of the goal square box (relative to ground)
const goal = { x: 540, w: 20 };
const goalColor = [252, 238, 33];
const surfacePipeColor = [103, 88, 76];
const dirtLayers = 7;
let connectionCountDown = 0;

// simulations constants
const angle = 0.01;
const startingAngle = 0.2967; // that is 17 degrees 
const machineWidth = 80;
const machineHeight = machineWidth * 9 / 16; // proportions according to the image
const pipeLengthMult = 0.87688219663; // relative to drilling machine width
const pipeLength = Math.floor(pipeLengthMult * machineWidth)- 2; // -2 accounts for the rounding of the pipe

const startingDepth = 2;
const startingX = 90;

const pipeOffset = 22; 
const maxStuckTimes = 3;

const verticalPipeMovement = 5; // this is used to initialize the connection time

// Pixel map for scene
let hddScene;
let fogOfUncertinty;
let reflections;

// Button to start
let startButton;
let aimingCheckbox;
let fogCheckbox;
let randomSlider;
// let direcitonSlider;
let pullBackButton;


function setGradient(image, x, y, w, h, c1, c2, axis) {
  image.noFill();

  if (axis === 1) {
    // Top to bottom gradient
    for (let i = y; i <= y + h; i++) {
      let inter = map(i, y, y + h, 0, 1);
      let c = lerpColor(c1, c2, inter);
      image.stroke(c);
      image.line(x, i, x + w, i);
    }
  } else if (axis === 0) {
    // Left to right gradient
    for (let i = x; i <= x + w; i++) {
      let inter = map(i, x, x + w, 0, 1);
      let c = lerpColor(c1, c2, inter);
      image.stroke(c);
      image.line(i, y, i, y + h);
    }
  }
}

function toggleBias() {
  bias *= -1;
}

function startStopAction(){
  if (state == 'PAUSED' || state == 'STUCK') {
    state = 'DRILLING';
    let prevPath = undefined;
    if (oldPaths.length > 0){
      prevPath = oldPaths[oldPaths.length - 1];
    }
    let oldPathPoint = undefined;
    if (prevPath && prevPath.length > 0) {
      // taking the first element of the last path (closest to the current bit position)
      oldPathPoint = prevPath[0];
    }
    // check if the previous segment drilled is near by and we are 'side-tracking'
    if (oldPathPoint && 
        dist(pos.x, pos.y, oldPathPoint[0].x, oldPathPoint[0].y) < 1.5){
      sideTrackCount++;
      console.log("Side-track count" + sideTrackCount);
    } //else {
    startCount++;
    console.log("Start count" + startCount);
  } else if (state == 'DRILLING') {
    state = 'PAUSED';
  } else if (state == 'WIN' || state == 'LOSE') {
    currentSeed = Math.floor(Math.random() * 999998)+1;
    updateDivWithLinkToThisLevel();
    randomSeed(currentSeed);
    startDrill();
  }
  updateStartButtonText();
}

function pullBack() {
  if (state == "PAUSED" || state == "DRILLING" || state == "STUCK") {
    state = 'PAUSED';
    let prevPosition = Math.floor((pathPosition - 1) / pipeLength) * pipeLength;
    if (prevPosition > 0) {
      oldPaths.push(path.slice(prevPosition));
      path = path.slice(0, prevPosition);
      pathPosition = path.length - 1;
      pos = path[pathPosition][0].copy();
      dir = path[pathPosition][1].copy();
    }
    updateStartButtonText();
  }
}

function touchStarted() {
  // ellipse(mouseX, mouseY, 5, 5);
  if (mouseY > height || mouseX < 0 || mouseX > width){
    return true;
  }
  else if (mouseX <= machineWidth && 
      mouseY <= groundLevel &&
      mouseY >= groundLevel - machineHeight){
    startStopAction();
  }
  else{
    toggleBias();
  }
  // prevent default
  return false;
}

function keyPressed() {
  // TODO reformat to a single function
  if (key == " ") {
    toggleBias();
  } else if (keyCode == ESCAPE || keyCode == RETURN || keyCode == ENTER) {
    startStopAction();
  } else if (keyCode == BACKSPACE) {
    pullBack();
  }
}

function drawRiver(hddScene, riverColor) {
  hddScene.noStroke();
  // hddScene.rectMode(CORNER);
  // hddScene.fill(groundColor);
  // hddScene.rect(0, groundLevel, width, height - groundLevel);
  hddScene.fill(riverColor);
  hddScene.arc(width / 2 + startingX / 2, groundLevel, width / 2, width / 4, 0, PI);
}

function createHddScene() {
  hddScene = createGraphics(width, height);
  // Draw a new scene
  hddScene.background(backgroundColor);

  // Generate the dirt layers
  const landscapeIterations = 100;
  let dirt = [];
  for (let l = 0; l < dirtLayers; l++) {
    noiseSeed(random(1000));
    dirt.push([]);
    for (let i = 0; i < landscapeIterations; i++) {
      dirt[dirt.length - 1].push(
        noise((i * width) / (landscapeIterations * 100))
      );
    }
  }

  // Draw the dirt layers
  hddScene.push();
  hddScene.noFill();
  hddScene.strokeWeight(3);
  for (let l = 0; l < dirtLayers; l++) {
    hddScene.noStroke();
    hddScene.colorMode(HSB);
    hddScene.fill(24, random(30, 90), 30);
    hddScene.beginShape();
    for (let x = 0; x < landscapeIterations; x++) {
      // Calculate the y of the dirt
      let y = 0;
      for (let i = 0; i < l; i++) {
        y += ((2.5 * (height - groundLevel)) / dirtLayers) * dirt[i][x];
      }
      hddScene.vertex((x * width) / landscapeIterations, groundLevel + y);
    }
    // Wrap around so the whole shape can be filled
    hddScene.vertex(width, groundLevel);
    hddScene.vertex(width, height);
    hddScene.vertex(0, height);
    hddScene.endShape(CLOSE);
  }
  hddScene.pop();

  drawRiver(hddScene, riverColor);

  for (let i = 0; i < 10; i++) {
    let r = random(8, 36);
    let x = random(0, width);
    let y = random(groundLevel + 50, height - 50);
    boulders.push([x, y, r]);
    hddScene.fill(boulderColor);
    hddScene.circle(x, y, r * 2);
  }
  hddScene.fill(45, 197, 244);
  hddScene.noStroke();
  hddScene.rect(0, 0, width, groundLevel);

  // Add the goal
  hddScene.fill(goalColor);
  hddScene.rect(goal.x - 2, groundLevel - goal.w - 2, goal.w + 4, goal.w + 4);
  hddScene.triangle(goal.x - 6, groundLevel - goal.w - 2, 
                    goal.x + goal.w + 6, groundLevel - goal.w - 2,
                    goal.x + goal.w / 2, groundLevel - goal.w * 1.8);
}

function createFogOfUncertainty() {
  fogOfUncertinty = createGraphics(width, height);
  // Draw a new scene
  fogOfUncertinty.background(0, 0);
  setGradient(fogOfUncertinty, 0, groundLevel, width, goal.w*2, color(255), color(0), 1);
  fogOfUncertinty.fill(0);
  fogOfUncertinty.noStroke();
  fogOfUncertinty.rect(0, groundLevel + goal.w*2, width, height);

  drawRiver(fogOfUncertinty, color(255));
}

function createReflections() {
  reflections = createGraphics(width, height);
  reflections.background(0, 0);
  drawReflection(reflections);
}

// Reset the initial state
function startDrill() {
  pos = createVector(startingX, groundLevel + startingDepth);
  dir = p5.Vector.fromAngle(startingAngle);
  path = [];
  oldPaths = [];
  pathPosition = -1;
  stuckCount = 0;
  startCount = 0;
  sideTrackCount = 0;
  boulders = [];
  bias = 1;
  state = 'PAUSED';
  startButton.html('start');

  // Related circle size
  const turnCircleLen = (PI * 2) / angle;
  turnCircleRadius = turnCircleLen / PI / 2;
  

  createHddScene();
  createFogOfUncertainty();
  createReflections();
}

function updateDivWithLinkToThisLevel() {
  seedDiv.html('<a href="?seed='+currentSeed+'">Persistent link to THIS level</a>');
}

function updateStartButtonText() {
  if (state == 'DRILLING' || state == 'CONNECTION') {
    startButton.html('pause');
  } 
  if (state == 'PAUSED' || state == 'STUCK') {
    startButton.html('drill');
  } 
  if (state == "WIN" || state == "LOSE") {
    startButton.html("new game");
  }
}

function setup() {
  // Let's begin!
  canvas = createCanvas(600, 400);
  // canvas.touchStarted(sceneOnTouchStarted);
  // frameRate(10);

  // Handle the start and stop button
  startButton = createButton('start').mousePressed(startStopAction);

    // Handle the toggle bias button
    createButton("toggle bias").mousePressed(function () {
        toggleBias();
    });

    pullBackButton = createButton("pull back");
    pullBackButton.mousePressed(function () {
        pullBack();
    });

    // A slider for adding some randomness (in %)

    const slider = document.createElement("input");
    slider.setAttribute("id", "rand-slider");
    slider.setAttribute("type", "range");
    slider.setAttribute("min", "0");
    slider.setAttribute("max", "100");
    slider.setAttribute("value", "50");
    slider.setAttribute("step", "0.5");
    const sliderLabel = document.createElement("label");
    sliderLabel.innerHTML = "randomness: ";
    sliderLabel.setAttribute("for", "rand-slider");
    const sliderContainer = document.createElement("div");
    sliderContainer.setAttribute("id", "rand-slider-container");
    sliderContainer.appendChild(sliderLabel);
    sliderContainer.appendChild(slider);
    document.querySelector("body").appendChild(sliderContainer);

    randomSlider = document.getElementById("rand-slider");

    // createSpan('direction: ');
    // direcitonSlider = createSlider(-1, 1, 1, 2);

    // A button for previewing steering bounds for aiming (@Denisovich I insist on the "limits")
    aimingCheckbox = createCheckbox("Steering limits", true).id("steer-lim-box");
    fogCheckbox = createCheckbox("Fog of uncertainty", true).id("fog-box");

    createDiv(
        '<a href="instructions/instructions-slide.png">Visual instructions</a>'
    ).id("visual-instructions");
    createDiv(
        'Copyright (c) 2022 Daniel Shiffman; Sergey Alyaev; ArztKlein; Denisovich; tyomka896 <a href="LICENSE.md">MIT License</a>'
    ).id("copyright");

    let params = getURLParams();
  if (params) {
    if (params["seed"]) {
      currentSeed = params["seed"];
      randomSeed(currentSeed);
    }
  }
  if (!currentSeed) {
    currentSeed = Math.floor(Math.random() * 999998)+1;
    randomSeed(currentSeed);
  }

  seedDiv = createDiv('<a href="?seed=">Persistent link to THIS level</a>').id('seed-div');
  updateDivWithLinkToThisLevel();

  machineBack = loadImage('assets/drilling-machine-small.png');
  machineFront = loadImage('assets/machine-foreground-small.png');

  startDrill();
}

// One drill step
function drill() {
  // update bias based on mouse input 
  // scrapped for now
  // if (mouseY < pos.y){
  //   bias = -1;
  // } else{
  //   bias = 1;
  // }

  dir.rotate(angle * bias);

  // Add some randomness
  const randomFactor = randomSlider.value;
  const r = (random(-randomFactor, 0) * angle * bias) / 100;
  dir.rotate(r);


  // Drilling mode
  // Save previous position
  path.push([pos.copy(), dir.copy()]);
  pathPosition = path.length - 1;
  if (path.length % pipeLength == 0) {
    state = "CONNECTION";
    connectionCountDown = verticalPipeMovement;
  }
  // Reduce uncertainty
  fogOfUncertinty.noStroke();
  fogOfUncertinty.fill(255);
  fogOfUncertinty.circle(pos.x, pos.y, goal.w*2);
  pos.add(dir);
  if (pos.x < 0 || pos.x > width || pos.y > height) {
    state = 'LOSE';
    updateStartButtonText();
  }

  // Get pixel color under drill
  let c = hddScene.get(pos.x, pos.y);
  // Remove the alpha component
  c = c.splice(0, 3);
  // Turn the colour into a string so we can compare it
  c = c.toString();

  // Green you win!
  if (c == goalColor.toString()) {
    state = 'WIN';
    updateStartButtonText();
    // Anything else not the ground color you lose!
  } else if (c == boulderColor.toString()) {
    state = 'STUCK';
    stuckCount++;
    if (stuckCount >= maxStuckTimes) {
      state = 'LOSE';
    }
    updateStartButtonText();
  } else if (
    c == backgroundColor.toString() ||
    c == riverColor.toString() ||
    c == boundaryColor.toString()
  ) {
    state = 'LOSE';
    updateStartButtonText();
  }
}

function drawReflection(reflectionImage) {
  const spacing = goal.w;
  const step = 1;
  const visualRad = 3;
  const errorPercent = 10;
  for (let x = 0; x < width - spacing; x+=step) {
    let minTravelDist = computeReflextionTimeSinglePoint(x, x + spacing);
    let distToObjWithNoize = (100 + random(-10, 10)) / 100. * minTravelDist / 2;
    let xMid = x + spacing / 2;
    reflectionImage.fill(125);
    reflectionImage.noStroke();
    reflectionImage.circle(xMid, distToObjWithNoize + groundLevel, visualRad);
  }
  // drawRiver(reflectionImage);
}

function computeReflextionTimeSinglePoint(x0, x1) {
  let minArrivalDist = height * 2;
  //const maxSteps = height * 2;
  for (let j = 0; j < boulders.length; j++) {
    for (let i = 0; i < 360; i+= 10) {
      // looping angles on the boulder
      let boulderDir = i * PI / 180;
      let boulderPoint = createVector(boulders[j][0], boulders[j][1]);
      boulderPoint.add(p5.Vector.fromAngle(boulderDir, boulders[j][2]));
      if (boulderPoint.x > x1 || boulderPoint.x < x0) {
        continue;
      }
      let distDown = dist(x0, groundLevel, boulderPoint.x, boulderPoint.y);
      let distUp = dist(x1, groundLevel, boulderPoint.x, boulderPoint.y);
      let totalDist = distDown + distUp;
      if (totalDist < minArrivalDist) {
        minArrivalDist = totalDist;
      }
    }
  }
  return minArrivalDist;
  // for (let i = 1; i < 180; i++){
  //   let dir = p5.Vector.fromAngle(i * PI / 180);
  //   let pos = createVector(x0, groundLevel);
  //   let step = 0;
  //   while (step < maxSteps){
  //     pos.add(dir);
  //     step++;
  //     for (let j = 0; j < boulders.length; j++) {
  //       if (dist(pos.x, pos.y, boulders[j][0], boulders[j][1]) <= boulders[j][2]){
  //         // collision detected, reflect
  //       }
  //     }
  //   }
  // }
}

function drawSurfacePipe() {
  let visibleLength = pipeLength - path.length % pipeLength + pipeOffset;
  push();
  translate(startingX, groundLevel + startingDepth);
  rotate(startingAngle);
  strokeWeight(3);
  stroke(surfacePipeColor);
  if (state == "CONNECTION") {
    // loading the pipe 
    line(-pipeLength-pipeOffset, -connectionCountDown, -pipeOffset, -connectionCountDown);
    line(-pipeOffset, 0, 0, 0);
  } else {
    line(-visibleLength, 0, 0, 0);
  }
  noStroke();
  fill('black');
  rect(-visibleLength-4, -5, 4, 9); // top drive / pusher for the pipe constants are hard coded to look nice
  pop();
}

function padNumber(num){
  return String(num).padStart(5, ' ')
}

function drawEndGameStatsAtY(textY){
  textAlign(RIGHT, TOP);
  noStroke();
  fill(255);
  textFont('courier-bold');
  const fontSize = 24;
  const textX = width - fontSize;
  textSize(fontSize);
  
  let reward = 0;
  if (state == "WIN"){
    reward = 5000;
    text(`mission reward = ${padNumber(reward)}+`, textX, textY);
  } else {
    reward = 1000;
    text(`partial reward = ${padNumber(reward)}+`, textX, textY);
  }
  textY += fontSize;
  if (state == "WIN"){
    text(`final pipe length = ${padNumber(path.length)}-`, textX, textY);
    reward -= path.length;
  } else{
    let remainingDistance = Math.ceil(dist(pos.x, pos.y, goal.x + goal.w/2, groundLevel));
    text(`remaining distance = ${padNumber(remainingDistance)}-`, textX, textY);
    reward -= remainingDistance;
  }
  textY += fontSize;

  let length = path.length;
  for (let oldPath of oldPaths) {
    length += oldPath.length;
  }
  text(`drilled length = ${padNumber(length)}-`, textX, textY);
  reward -= length;
  
  textY += fontSize;
  const startMult = Math.ceil(pipeLength/40) * 10;
  let startCost = startCount * startMult;
  text(`starts: ${startCount} *${startMult} = ${padNumber(startCost)}-`, textX, textY);
  reward -= startCost;

  textY += fontSize;
  const sideTrackMult = Math.ceil(pipeLength/20) * 10;
  let sideTrackCost = sideTrackCount * sideTrackMult;
  text(`side-tracks: ${sideTrackCount} *${sideTrackMult} = ${padNumber(sideTrackCost)}-`, textX, textY);
  reward -= sideTrackCost;

  textY += fontSize;
  const stuckMult = Math.ceil(pipeLength/50) * 50;
  let stuckCost = stuckCount * stuckMult;
  text(`stuck count: ${stuckCount} *${stuckMult} = ${padNumber(stuckCost)}-`, textX, textY);
  reward -= stuckCost;

  textY += fontSize * 1.5;
  text(`FINAL SCORE = ${padNumber(reward)} `, textX, textY);
  return reward;
}

// Draw loop
function draw() {

  // Dril!
  if (state == "DRILLING") drill();

  // Draw the scene
  image(hddScene, 0, 0);
  if (!(state == "WIN" || state == "LOSE")  && fogCheckbox.checked()) {
    blendMode(MULTIPLY);
    image(fogOfUncertinty, 0, 0);
    blendMode(BLEND);
  }
  image(reflections, 0, 0);

  // draw the machine
  image(machineBack, 0, groundLevel - machineHeight + 2, machineWidth, machineHeight);
  drawSurfacePipe();
  image(machineFront, 0, groundLevel - machineHeight + 2, machineWidth, machineHeight);

  // Draw the paths
  // abandoned paths first
  for (let oldPath of oldPaths) {
    beginShape();
    noFill();
    stroke(125);
    strokeWeight(2);
    for (let vPair of oldPath) {
      let v = vPair[0]
      vertex(v.x, v.y);
    }
    endShape();
  }
  // the newest well
  beginShape();
  noFill();
  stroke(255);
  strokeWeight(4);
  for (let vPair of path) {
    let v = vPair[0]
    vertex(v.x, v.y);
  }
  endShape();

  // Draw something where drill starts
  fill(255, 0, 0);
  stroke(0);
  strokeWeight(4);

  if (aimingCheckbox.checked() && !(state == "WIN" || state == "LOSE")) {
    // Start of the aiming arcs
    push();
    translate(pos.x, pos.y);
    rotate(dir.heading());

    // Draw the aiming lines
    stroke(125);
    strokeWeight(1);
    noFill();
    const maxAimAngle = QUARTER_PI * 1.8;
    arc(
      0,
      -turnCircleRadius,
      turnCircleRadius * 2,
      turnCircleRadius * 2,
      HALF_PI - maxAimAngle,
      HALF_PI,
      OPEN
    );
    arc(
      0,
      turnCircleRadius,
      turnCircleRadius * 2,
      turnCircleRadius * 2,
      -HALF_PI,
      -HALF_PI + maxAimAngle,
      OPEN
    );
    pop();
  }

  // Draw the drill bit
  push();
  stroke(252, 238, 33);
  strokeWeight(8);
  translate(pos.x, pos.y);
  rotate(dir.heading() + (startingAngle) * bias);
  line(0, 0, 10, 0);
  pop();

  // circle(xTouch, yTouch, 10);

  if (state == "CONNECTION"){
    textAlign(CENTER, TOP);
    noStroke();
    fill(255);
    textSize(24);
    textFont('courier');
    text('*pipe handling*', width / 2, groundLevel / 2);
    connectionCountDown--;
    if (connectionCountDown <= 0) {
      state = "DRILLING";
    }
  }

  if (state == 'STUCK') {
    textAlign(CENTER, TOP);
    noStroke();
    fill(255);
    textSize(24);
    textFont('courier');
    text('STUCK! ('+stuckCount+'/'+maxStuckTimes+' times)', width / 2, groundLevel / 2);
  }

  if (state != "DRILLING"){
    textAlign(LEFT, TOP);
    noStroke();
    fill(255);
    textSize(16);
    textFont('courier');
    text('Click the machine \nto start / pause', 3, 3);
    text('Click anywehere else\nto toggle bias', width/2, 3)
  }


  // If you've lost!
  if (state == 'LOSE') {
    background(255, 0, 0, 150);
    textAlign(CENTER, TOP);
    noStroke();
    fill(255);
    textSize(96);
    textFont('courier-bold');
    text('YOU LOSE', width / 2, groundLevel);
    drawEndGameStatsAtY(groundLevel + 96);
  } // If you've won!
  else if (state == 'WIN') {
    background(0, 255, 0, 150);
    textAlign(CENTER, TOP);
    noStroke();
    fill(255);
    textSize(96);
    textFont('courier-bold');
    text('YOU WIN', width / 2, groundLevel);
    // Starting idea for a score
    drawEndGameStatsAtY(groundLevel + 96);
  }
}
