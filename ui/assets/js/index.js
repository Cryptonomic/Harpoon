const selectPanel = (event, panel) => {
  document
    .querySelectorAll(".panel")
    .forEach((node) => (node.style.display = "none"));
  document
    .querySelectorAll(`.${panel}`)
    .forEach((node) => (node.style.display = "block"));
  document
    .querySelectorAll(".blocks-hour")
    .forEach((node) => (node.style.display = "none"));
  document
    .querySelectorAll(`.${panel}-block`)
    .forEach((node) => (node.style.display = "flex"));
  document
    .querySelectorAll(`.tab-title`)
    .forEach(
      (node) => (node.className = node.className.replace(" active", ""))
    );
  event.currentTarget.className += " active";
};

const copyToClipBoard = (copyPanel) => {
  let str = document.querySelector(`.${copyPanel}`).textContent;
  const el = document.createElement("textarea");
  el.value = str;
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
};
