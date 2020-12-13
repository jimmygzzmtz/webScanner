// Started modifications by removing the use of JQuery and sticking to HTML5 elements, as well as updating the OpenCV verison.
// Additional work went into gaussian threshold and grayscale filter, rotation and flipping options,
// stopping the editing process when the next button is clicked, and adding a PDF export function.

var imagesArrayBuffers = [];

// Initializes the input element and its event listener
function init(){
    const inputElement = document.getElementById("input");
    inputElement.addEventListener("change", handleFiles, false);
 
    startEvents();

    switchView("select");
}

// https://pdf-lib.js.org/
// Used to create a PDF based on the saved images in the imagesArrayBuffers list
async function createPDF() {

    var PDFDocument = PDFLib.PDFDocument;    

    const pdfDoc = await PDFDocument.create();
    var jpgImage;
    var page;
    for(var i = 0; i < imagesArrayBuffers.length; i++){
        jpgImage = await pdfDoc.embedJpg(imagesArrayBuffers[i]);
        page = pdfDoc.addPage();
            page.drawImage(jpgImage, {
            x: 0,
            y: 0,
            width: page.getWidth(),
            height: page.getHeight(),
        });
    }

    const pdfDataUri = await pdfDoc.saveAsBase64({ dataUri: true });
    var link = document.createElement('a');
    link.download = 'scan.pdf';
    link.href = pdfDataUri;
    link.click();
    
    imagesArrayBuffers = [];
  }

// Used to store the output image
var out;

// Starts listening for mouse/pointer inputs
function startEvents(){
    canvas.onpointerdown = canvasClick;
    canvas.onpointerup = stopDragging;
    canvas.onmouseout = stopDragging;
    canvas.onmousemove = dragCircle;
}

// Stops listening for mouse/pointer inputs, when rotating/flipping
function stopEvents(){
    canvas.onpointerdown = null;
    canvas.onpointerup = null;
    canvas.onmouseout = null;
    canvas.onmousemove = null;
}

// Sends the file to be processed
function handleFiles() {
    getEdges(this.files[0]);
    switchView("clip");
}

// Loads image to the site
function loadImage(file){
    return new Promise((resolve,reject)=>{
        const url = URL.createObjectURL(file);
        let img = new Image();
        img.onload = ()=>{
            resolve(img);
        };
        img.src = url;
    });
}

// Used to know which position to save in the points array, to be able to draw the points and lines
function canvasClick(e){
    console.log(e.pageX + "," + e.pageY);
    var x = e.pageX - e.target.offsetLeft;
    var y = e.pageY - e.target.offsetTop;
    
    for(var i=0; i<points.length; i++) {
        
        if(Math.pow(points[i].x - x , 2) + Math.pow(points[i].y - y , 2) < 100 ){
        points[i].selected = true;
        } else {
        if(points[i].selected) points[i].selected = false;
        }
    }
}

// Used to move the circle when clicking in the canvas
function dragCircle(e){
  for(var i=0; i<points.length; i++) if(points[i].selected) {
    points[i].x = e.pageX - e.target.offsetLeft;
    points[i].y = e.pageY - e.target.offsetTop;
  }
  draw();
}

// Used to know when the dragging of the circle has stopped
function stopDragging(e){
  for(var i=0; i<points.length; i++) {
    points[i].selected = false;
  }
}

// Draw the lines based on the points array
function draw(){
    var canvas = document.getElementById('canvas');
    context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img,0,0,img.width,img.height);
    drawPoints(points);

}

// Draw each point using the canvas context
function drawPoints(points){
    let context = document.getElementById('canvas').getContext('2d');
    for(var i=0; i<points.length; i++) {
        var circle = points[i];
 
        context.globalAlpha = 0.85;
        context.beginPath();
        context.arc(circle.x, circle.y, 5, 0, Math.PI*2);
        context.fillStyle = "black";
        context.strokeStyle = "black";
        context.lineWidth = 5;
        context.fill();
        context.stroke();
        context.beginPath();
        context.moveTo(circle.x, circle.y);
        context.lineTo( points[i-1>=0?i-1:3].x,  points[i-1>=0?i-1:3].y);
        context.stroke();
      
      }
}

// Get the edges of the image using OpenCV
async function getEdges(file){ 
    document.getElementById('viewSwitcher').children["clip"].children["clipBar"].style.display = "block";
    document.getElementById('viewSwitcher').children["clip"].children["editBar"].style.display = "none";
    let ctx = document.getElementById('canvas').getContext('2d');
    const img = await loadImage(file);

    document.getElementById('canvas').width = img.width;
    document.getElementById('canvas').height = img.height;

    window.img = img;
    ctx.drawImage(img,0,0,img.width,img.height);

    let image = cv.imread(document.getElementById('canvas'));
    window.image = image;
    let edges = new cv.Mat();
    cv.Canny(image,edges,100,200);
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();

    cv.findContours(edges,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
    
    let cnts = []
    for(let i=0;i<contours.size();i++){
        const tmp = contours.get(i);
        const peri = cv.arcLength(tmp,true);
        let approx = new cv.Mat();
        
        let result = {
            area:cv.contourArea(tmp),
            points:[]
        };

        cv.approxPolyDP(tmp,approx,0.02*peri,true);
        const pointsData = approx.data32S;
        for(let j=0;j<pointsData.length/2;j++)
            result.points.push({x:pointsData[2*j],y:pointsData[2*j+1]});
        
        if(result.points.length===4) cnts.push(result);
        
    }
    cnts.sort((a,b)=>b.area-a.area);

    window.points = cnts[0].points;
    drawPoints(cnts[0].points);
}

// Adds filter to the image
function filter(){
    document.getElementById('viewSwitcher').children["clip"].children["clipBar"].style.display = "none";
    document.getElementById('viewSwitcher').children["clip"].children["editBar"].style.display = "block";
    stopEvents();
    const tl = points[0],tr=points[1],br=points[2],bl=points[3];

    const width = Math.max(
        Math.sqrt((br.x-bl.x)**2 + (br.y-bl.y)**2),
        Math.sqrt((tr.x-tl.x)**2 + (tr.y-tl.y)**2),
    );

    const height = Math.max(
        Math.sqrt((tr.x-br.x)**2 + (tr.y-br.y)**2),
        Math.sqrt((tl.x-bl.x)**2 + (tl.y-bl.y)**2),
    );

    const from = cv.matFromArray(4,1,cv.CV_32FC2,[points[0].x,points[0].y,points[1].x,points[1].y,points[2].x,points[2].y,points[3].x,points[3].y]);
    const to = cv.matFromArray(4,1,cv.CV_32FC2,[0,0,width-1,0,width-1,height-1,0,height-1]);
    const M = cv.getPerspectiveTransform(from,to);
    out = new cv.Mat();
    let size = new cv.Size();
    size.width = width;
    size.height = height;
    cv.warpPerspective(image,out,M,size);
    
    // Converts image to grayscale
    cv.cvtColor(out, out, cv.COLOR_BGR2GRAY);

    // Adds a Gaussian Threshold to simulate a scanned image
    cv.adaptiveThreshold(out,out,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY,11,10)

    // Rotates and flips the image to attempt to fix the most common orientation mistake
    cv.rotate(out, out, cv.ROTATE_90_CLOCKWISE);
    cv.flip(out, out, 1);

    cv.imshow(document.getElementById('canvas'),out);
}

// Hides and shows buttons depending on the state of the process
function switchView(name){
    document.getElementById('viewSwitcher').children["select"].style.display = "none";
    document.getElementById('viewSwitcher').children["clip"].style.display = "none";
    document.getElementById('viewSwitcher').children[name].style.display = "block";
}

// Rotates the image
function rotate(){
    cv.rotate(out, out, cv.ROTATE_90_CLOCKWISE);
    cv.imshow(document.getElementById('canvas'),out);
}

// Flips the image vertically
function flipVertically(){
    cv.flip(out, out, 0);
    cv.imshow(document.getElementById('canvas'),out);
}

// Flips the image horizontally
function flipHorizontally(){
    cv.flip(out, out, 1);
    cv.imshow(document.getElementById('canvas'),out);
}

// Continues to the next image
async function nextImage(){
    var dataUriCanvas = document.getElementById('canvas').toDataURL('image/jpeg');
    const jpgImageBytes = await fetch(dataUriCanvas).then((res) => res.arrayBuffer());
    imagesArrayBuffers.push(jpgImageBytes);

    startEvents();
    switchView("select");
}

// Saves the current images as a png
function saveIndividual(){
    var link = document.createElement('a');
    link.download = 'filename.png';
    link.href = document.getElementById('canvas').toDataURL()
    link.click();
}

// Converts the scanned images to a PDF
function finish(){
    if(imagesArrayBuffers.length > 0){
        createPDF();
    }
    
}

init();