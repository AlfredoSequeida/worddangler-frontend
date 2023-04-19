import { useLoaderData, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { faker } from "@faker-js/faker";

const getRandomGif = async () => {
  const id = (
    await (
      await fetch(
        "https://api.giphy.com/v1/gifs/random?apiKey=7IfGSmZdSFRLfxQaPcLtpQamsqj1ySOa&tag=funny",
        { method: "GET" }
      )
    ).json()
  ).data.id;

  return `https://media0.giphy.com/media/${id}/giphy.gif`;
};

const Lobby = () => {
  const navigate = useNavigate();
  const { socket, gameCode } = useLoaderData();

  socket.emit("is-session-id-valid", gameCode.split("=")[1], (validation) => {
    if (gameCode.split("=")[0] != "gameCode" || validation != true) {
      navigate("/NotFound");
    }
  });

  localStorage.setItem("sessionId", gameCode.split("=")[1]);
  const toastRef = useRef();
  const modalRef = useRef();
  const modalErrorRef = useRef();
  const usernameRef = useRef();
  const [players, setPlayers] = useState([]);
  const [player, setPlayer] = useState({});

  const addPlayers = async (ps) => {
    setPlayers(
      await Promise.all(
        ps.map((player) =>
          getRandomGif().then((image) => ({
            ...player,
            image: image,
          }))
        )
      )
    );
  };

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem("session"));
    if (session) {
      (async () => {
        await addPlayers(session.players);
      })();
    }
  }, []);

  useEffect(() => {
    setPlayer(() => {
      const p = JSON.parse(localStorage.getItem("player"));
      if (!p || !p.username) {
        showModal();
      } else {
        hideModal();
      }
      return p;
    });
  }, []);

  useEffect(() => {
    socket.on("receive-session", async (res) => {
      await addPlayers(res.players);

      for (const p of res.players) {
        if (p.username == player.username) {
          setPlayer(p);

          localStorage.setItem(
            "player",
            JSON.stringify({
              ...p,
            })
          );
          break;
        }
      }

      localStorage.setItem("session", JSON.stringify(res));
    });
    return () => socket.off("receive-session");
  }, [socket]);

  useEffect(() => {
    socket.on("remove-disconnected-player", (p) => {
      let x = JSON.parse(localStorage.getItem("session"));
      x.players = p;
      addPlayers(p);
      localStorage.setItem("session", JSON.stringify(x));
      const playerUpdate = p.findIndex((item) => {
        return item.socketId === socket.id;
      });
      setPlayer(p[playerUpdate]);
      localStorage.setItem("player", JSON.stringify(p[playerUpdate]));
    });
    return () => socket.off("remove-disconnected-player");
  }, [socket]);

  function preventBack() {
    window.history.forward();
  }

  setTimeout(preventBack(), 0);

  window.onunload = function () {
    null;
  };

  const showToast = (msg) => {
    toastRef.current.childNodes[0].innerHTML = msg;
    toastRef.current.style.display = "block";
    setTimeout(() => (toastRef.current.style.display = "none"), 5000);
  };

  const showModalError = (msg) => {
    modalErrorRef.current.innerHTML = msg;
    modalErrorRef.current.style.display = "block";
    setTimeout(() => (modalErrorRef.current.style.display = "none"), 5000);
  };

  const showModal = () => {
    const className = modalRef.current.className;
    if (!className.includes("modal-open")) {
      modalRef.current.className = `${className} modal-open`;
    }
  };

  const hideModal = () => {
    modalRef.current.className = modalRef.current.className.replace(
      "modal-open",
      ""
    );
  };

  const setUserName = () => {
    const username = usernameRef.current.value;

    socket.emit(
      "join-session",
      { sessionId: localStorage.getItem("sessionId"), username: username },
      (res) => {
        if (res?.error) {
          showModalError(res.error);
        } else {
          hideModal();
          setPlayer(res);
          localStorage.setItem("player", JSON.stringify(res));
        }
      }
    );
  };

  return (
    <div className="flex flex-col justify-between items-center h-screen">
      <div ref={modalRef} className="modal">
        <div className="flex flex-col modal-box w-full space-y-2">
          <label>username</label>
          <div className="flex justify-between space-x-3">
            <input
              ref={usernameRef}
              className="input font-bold w-full"
              placeholder="username"
              defaultValue={faker.random.words(2).replace(" ", "")}
              autoFocus
            />
            <button className="btn text-xl" onClick={setUserName}>
              👉
            </button>
          </div>
          <div ref={modalErrorRef} className="text-error text-center"></div>
        </div>
      </div>
      <div>
        <div className="flex flex-col justify-center items-center py-2 mb-4 space-y-1">
          <h1 className="text-3xl font-bold">
            {localStorage.getItem("sessionId")}
          </h1>
          <button
            className="btn text-lg space-x-1"
            onClick={() => {
              navigator.clipboard.writeText(
                `http://localhost:3000/lobby/gameCode=${localStorage.getItem(
                  "sessionId"
                )}`
              );
              showToast("copied!");
            }}
          >
            <span></span>
            🔗
            <span>copy game link</span>
          </button>
          <div ref={toastRef} className="hidden toast-top toast-start p-2">
            <div className="alert alert-info"></div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-8 2xl:grid-cols-12 gap-3">
          {players.length > 0
            ? players.map((player, index) => (
                <div
                  key={index}
                  className="flex flex-col justify-center items-center space-y-1"
                >
                  <img
                    className="w-24 aspect-square rounded-full"
                    src={player.image}
                  />
                  <span className="font-bold break-all">{`${player.username} ${
                    player.isAdmin ? "👑" : ""
                  }`}</span>
                </div>
              ))
            : new Array(12).fill().map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="rounded-full bg-slate-700 h-24 w-24"></div>
                </div>
              ))}
        </div>
      </div>

      {player?.isAdmin ? (
        <div className="flex w-full justify-end p-4">
          <button
            className="btn text-xl"
            onClick={() => {
              if (players.length < 3) {
                showToast("Lobby Should have atleast 3 players");
              } else {
                socket.emit(
                  "is-admin",
                  {
                    sessionId: localStorage.getItem("sessionId"),
                    username: player.username,
                  },
                  (isAdmin) => {
                    if (isAdmin) {
                      navigate("/play");
                    } else {
                      showToast(
                        "nice try 😉, you need to be the admin to do that"
                      );
                    }
                  }
                );
              }
            }}
          >
            start game 🎮
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default Lobby;
