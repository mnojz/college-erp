import { AssetIcon, studentAssets } from "./assets";

type ProfileHeroProps = {
  name: string;
  email: string;
  status: string;
  program: string;
  department: string;
  admissionNo: string;
  rollNumber: string | null;
  profileImageUrl: string | null;
};

export function ProfileHero({ name, email, status, program, department, admissionNo, rollNumber, profileImageUrl }: ProfileHeroProps) {
  const studentId = rollNumber || admissionNo;
  return (
    <section className="profile-hero">
      <img className="profile-hero-image" src={profileImageUrl || studentAssets.avatar} alt="" width={110} height={110} />
      <div className="profile-hero-details">
        <div className="profile-name-row"><h1>{name}</h1><span className="active-badge"><img src={studentAssets.status} alt="" width={6} height={6} />{status}</span></div>
        <div className="profile-meta-row">
          <span><AssetIcon src={studentAssets.school} size={14} />{department || "Department not assigned"}</span>
          <span><AssetIcon src={studentAssets.calendar} size={14} />{program || "Program not assigned"}</span>
        </div>
        <p>Registration Number: <strong>{admissionNo}</strong> <span className="hero-email">{email}</span></p>
        <p className="hero-student-id">Student ID: {studentId}</p>
      </div>
      <div className="profile-hero-actions"><button type="button"><AssetIcon src={studentAssets.download} size={16} />Download ID Card</button><button className="profile-edit-button" type="button"><AssetIcon src={studentAssets.edit} size={16} />Edit Profile</button></div>
    </section>
  );
}
