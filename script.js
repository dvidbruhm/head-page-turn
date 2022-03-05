let video;
let video_container;
let canvas;
let model;
let context;
const angle_threshold = 15;

const DEBUG = false;

var pdf_doc;
var total_pages = 0;
var page_rendering_in_progress = true;
var current_page = 1;
var pdf_canvas;
var pdf_file;
var drop_container;

async function setup_camera() {
    video = document.getElementById("webcam");
    video_container = document.querySelector(".video-container");
    if (DEBUG)
        video_container.style.display = "block";
    else
        video_container.style.display = "none";

    const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user" },
    });
    video.srcObject = stream;

    return new Promise((resolve) => {
        video.onloadedmetadata = () => {
            resolve(video);
        };
    });
}

const setup_pdf_page = async () => {
    drop_container = document.querySelector("#drop-container");
    drop_container.style.display = "none";

    await setup_camera();
    video.play();

    if (DEBUG) {
        videoWidth = video.videoWidth;
        videoHeight = video.videoHeight;
        canvas = document.getElementById("landmarks");
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        context = canvas.getContext("2d");
        context.fillStyle = "rgba(255, 255, 255, 0.5)";
        context.strokeStyle = "rgba(255, 255, 255, 0.5)";
    }

    model = await blazeface.load();

    pdf_container = document.getElementById("pdf-container");
    pdf_container.style.display = "block";
    pdf_canvas = document.getElementById("pdf-canvas");
    pdf_canvas.height = pdf_container.getBoundingClientRect().height;

    button_next = document.querySelector(".pdf-next");
    button_next.style.display = "block";
    button_prev = document.querySelector(".pdf-prev");
    button_prev.style.display = "block";

    draw_pdf(pdf_file);
    process_webcam(video, context);
};

async function get_landmarks(video) {
    const predictions = await model.estimateFaces(video);
    if (predictions.length == 0) return;
    i = 0;
    const start = predictions[i].topLeft;
    const end = predictions[i].bottomRight;
    const size = [end[0] - start[0], end[1] - start[1]];
    let landmarks = {
        right_eye: predictions[i].landmarks[0],
        left_eye: predictions[i].landmarks[1],
        nose: predictions[i].landmarks[2],
        mouth: predictions[i].landmarks[3],
    };
    return landmarks;
}

function get_angle(landmarks) {
    let dir = [
        landmarks.left_eye[0] - landmarks.right_eye[0],
        landmarks.left_eye[1] - landmarks.right_eye[1],
    ];
    let dir_norm = [0, 0];
    dir_norm[0] = dir[0] / Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1]);
    dir_norm[1] = dir[1] / Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1]);
    angle = (Math.atan2(dir_norm[1], dir_norm[0]) * 180) / Math.PI;
    return angle;
}

let cannot_page_turn = false;
function turn_page(angle) {
    let page_turn = false;

    if (cannot_page_turn == true && Math.abs(angle) < angle_threshold - 1) {
        cannot_page_turn = false;
    }
    if (cannot_page_turn == true) {
        return false;
    }

    if (Math.abs(angle) > angle_threshold + 1 && page_turn == false) {
        page_turn = true;
        cannot_page_turn = true;
    } else if (page_turn == true) {
        page_turn = false;
    }

    return page_turn;
}

function draw_landmarks(landmarks, context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillRect(landmarks.nose[0] - 4, landmarks.nose[1] - 4, 8, 8);
    context.fillRect(landmarks.mouth[0] - 4, landmarks.mouth[1] - 4, 8, 8);
    context.fillRect(landmarks.left_eye[0] - 4, landmarks.left_eye[1] - 4, 8, 8);
    context.fillRect(landmarks.right_eye[0] - 4, landmarks.right_eye[1] - 4, 8, 8);
    context.beginPath();
    context.moveTo(landmarks.nose[0], landmarks.nose[1]);
    context.lineTo(landmarks.mouth[0], landmarks.mouth[1]);
    context.stroke();
    context.beginPath();
    context.moveTo(landmarks.left_eye[0], landmarks.left_eye[1]);
    context.lineTo(landmarks.right_eye[0], landmarks.right_eye[1]);
    context.stroke();
}

let last_angles = [];
let last_angles_len = 4;
async function process_webcam(video, context) {
    let landmarks = await get_landmarks(video);

    let angle = get_angle(landmarks);

    last_angles.unshift(angle);
    if (last_angles.length > last_angles_len) last_angles.pop();
    const sum = last_angles.reduce((a, b) => a + b, 0);
    const avg_angle = sum / last_angles.length || 0;

    let page_turn = turn_page(avg_angle);
    if (page_turn) {
        if (page_rendering_in_progress == false) {
            if (avg_angle > 0) next_page();
            else if (avg_angle < 0) prev_page();
        }
    }

    if (DEBUG)
        draw_landmarks(landmarks, context);

    setTimeout(process_webcam, 10, video, context);
}

async function draw_pdf(pdf_url) {
    pdf_doc = await pdfjsLib.getDocument({ url: pdf_url }).promise;
    total_pages = pdf_doc.numPages;
    current_page = 1;
    draw_page(1);
}

async function draw_page(page_nb) {
    page_rendering_in_progress = true;

    document.querySelector("#button-next").disabled = true;
    document.querySelector("#button-prev").disabled = true;

    current_page = page_nb;
    var page = await pdf_doc.getPage(page_nb);

    var viewport = page.getViewport({ scale: pdf_canvas.height / page.getViewport({ scale: 1.0 }).height });

    pdf_canvas.height = viewport.height;
    pdf_canvas.width = viewport.width;
    pdf_canvas.style.left = (window.innerWidth - viewport.width) / 2 + "px";

    await page.render({
        canvasContext: pdf_canvas.getContext('2d'),
        viewport: viewport
    }).promise;

    page_rendering_in_progress = false;

    document.querySelector("#button-next").disabled = false;
    document.querySelector("#button-prev").disabled = false;
}

function prev_page() {
    if (current_page != 1) draw_page(--current_page);
    console.log("PREV", current_page);
}

function next_page() {
    if (current_page != total_pages) draw_page(++current_page);
    console.log("NEXT", current_page);
}

function get_key_down(e) {
    if (page_rendering_in_progress) {
        return;
    }
    if (e.keyCode == 37)  // Left arrow
        prev_page();
    else if (e.keyCode == 39)  // Right arrow
        next_page();
}

function is_pdf(file_type) {
    return file_type.split("/").pop().toLowerCase() == "pdf";
}

function dropHandler(ev) {
    console.log('File(s) dropped');

    // Prevent default behavior (Prevent file from being opened)
    ev.preventDefault();

    //TODO: make popups instead of console
    if (ev.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s) if available

        if (ev.dataTransfer.items.length > 1) {
            console.log("Please drop only 1 pdf file.");
            return;
        }

        // If dropped items aren't files, reject them
        if (!ev.dataTransfer.items[0].kind === 'file') {
            console.log("Please drop a file.");
            return;
        }

        var file = ev.dataTransfer.items[0].getAsFile();

        if (!is_pdf(file.type)) {
            console.log("The file is not a pdf.");
            return;
        }

        let reader = new FileReader();
        reader.readAsDataURL(file);
        let originalFileURL = URL.createObjectURL(file);
        reader.onload = () => {
            pdf_file = originalFileURL;
            setup_pdf_page();
        };

    } else {
        // Use DataTransfer interface to access the file(s)
        if (ev.dataTransfer.files.length > 1) {
            console.log("Please drop only 1 pdf file.");
            return;
        }

        var file = ev.dataTransfer.files[0];

        if (!is_pdf(file.type)) {
            console.log("The file is not a pdf.");
            return;
        }

        console.log(file.name);
    }
}

function dragOverHandler(ev) {
    console.log('File(s) in drop zone');

    // Prevent default behavior (Prevent file from being opened)
    ev.preventDefault();
}


document.onkeydown = get_key_down;

//setup_pdf_page();


// TODO: Nicer front page:
//          - better colors
//          - change color when dragging file over drag area
//          - nicer browse button
//       Make Browse button work like drag & drop