var canvas = document.querySelector("canvas");
var context = canvas.getContext("2d");
const video = document.querySelector("#webcam");

//w-width,h-height
var w, h;
canvas.style.display = "none";

async function snapshot() {
    const model = await blazeface.load();
    w = video.clientWidth;
    h = video.clientHeight;
    canvas.width = w;
    canvas.height = h;

    context.fillRect(0, 0, w, h);
    context.drawImage(video, 0, 0, w, h);
    canvas.style.display = "block";

    console.debug(model);
    const predictions = await model.estimateFaces(video, false);
    console.debug("allo");
    console.debug(predictions);

    for (let i = 0; i < predictions.length; i++) {
        const start = predictions[i].topLeft;
        const end = predictions[i].bottomRight;
        const size = [end[0] - start[0], end[1] - start[1]];

        // Render a rectangle over each detected face.
        context.fillRect(start[0], start[1], size[0], size[1]);
    }
}

window.navigator.mediaDevices
    .getUserMedia({ video: true, audio: false })
    .then((stream) => {
        video.srcObject = stream;
        video.onloadedmetadata = (e) => {
            video.play();

            w = video.clientWidth;
            h = video.clientHeight;
            canvas.width = w;
            canvas.height = h;
        };
    })
    .catch((error) => {
        alert("You have to enable the mike and the camera");
    });
