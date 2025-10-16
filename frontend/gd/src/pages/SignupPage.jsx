// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";

// function SignupPage() {
//   const [username, setUsername] = useState("");
//   const [password, setPassword] = useState("");
//   const [email, setEmail] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [success, setSuccess] = useState("");
//   const navigate = useNavigate();

//   const handleSignup = async (e) => {
//     e.preventDefault();
//     setError("");
//     setSuccess("");
//     setLoading(true);

//     try {
//       const response = await fetch("http://127.0.0.1:8000/signup", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ username, password, email }),
//       });

//       if (response.ok) {
//         const data = await response.json();
//         console.log("✅ Signup successful:", data);
//         setSuccess("Signup successful! Redirecting to login...");
//         setTimeout(() => navigate("/login"), 2000);
//       } else {
//         const err = await response.json();
//         setError(err.detail || "Signup failed. Try again.");
//       }
//     } catch (err) {
//       console.error("❌ Error:", err);
//       setError("Server not reachable. Please try again later.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="center-screen">
//       <div className="box-container login-box">
//         <h2 className="page-title">Create an Account</h2>
//         <form className="login-form" onSubmit={handleSignup}>
//           <input
//             className="input"
//             type="text"
//             placeholder="Enter Username"
//             value={username}
//             onChange={(e) => setUsername(e.target.value)}
//             required
//           />
//           <input
//             className="input"
//             type="email"
//             placeholder="Enter Email"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//           />
//           <input
//             className="input"
//             type="password"
//             placeholder="Enter Password"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             required
//           />
//           <button className="primary-btn" type="submit" disabled={loading}>
//             {loading ? "Creating account..." : "Sign Up"}
//           </button>

//           {error && <p className="error-text">{error}</p>}
//           {success && <p className="success-text">{success}</p>}
//         </form>
//       </div>
//     </div>
//   );
// }

// export default SignupPage;
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SignupPage.css"; // Import CSS

function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Signup successful:", data);
        setSuccess("Signup successful! Redirecting to login...");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        const err = await response.json();
        setError(err.detail || "Signup failed. Try again.");
      }
    } catch (err) {
      console.error("❌ Error:", err);
      setError("Server not reachable. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="center-screen">
      <div className="box-container login-box">
        <h2 className="page-title">Create an Account</h2>
        <form className="login-form" onSubmit={handleSignup}>
          <input
            className="input"
            type="text"
            placeholder="Enter Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            className="input"
            type="email"
            placeholder="Enter Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Enter Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength="6"
            maxLength="72"
          />
          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Sign Up"}
          </button>

          {error && <p className="error-text">{error}</p>}
          {success && <p className="success-text">{success}</p>}
        </form>
        
        <p className="redirect-text">
          Already have an account? <a href="/login">Login here</a>
        </p>
      </div>
    </div>
  );
}

export default SignupPage;