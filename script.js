let video;
let canvas;
let model;
let angleText;
const angle_threshold = 15;

async function setupCamera() {
    video = document.getElementById("webcam");

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

const setupPage = async () => {
    await setupCamera();
    video.play();

    videoWidth = video.videoWidth;
    videoHeight = video.videoHeight;

    canvas = document.getElementById("landmarks");
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    context = canvas.getContext("2d");
    context.fillStyle = "rgba(255, 255, 255, 0.5)";
    context.strokeStyle = "rgba(255, 255, 255, 0.5)";

    angleText = document.getElementById("angle");

    model = await blazeface.load();
    draw(video, context);
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
async function draw(video, context) {
    let landmarks = await get_landmarks(video);

    let angle = get_angle(landmarks);

    last_angles.unshift(angle);
    if (last_angles.length > last_angles_len) last_angles.pop();
    const sum = last_angles.reduce((a, b) => a + b, 0);
    const avg_angle = sum / last_angles.length || 0;
    angleText.innerHTML = "Angle = " + avg_angle;
    //console.log(angle, avg_angle, last_angles);

    let page_turn = turn_page(avg_angle);
    if (page_turn) console.log("PAGE TURN! :D - " + Math.random());

    draw_landmarks(landmarks, context);

    setTimeout(draw, 10, video, context);
}

setupPage();
