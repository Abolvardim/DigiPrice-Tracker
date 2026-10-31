const input=document.getElementById("token");
const status=document.getElementById("status");
chrome.storage.local.get(["githubToken"],({githubToken})=>{if(githubToken)input.value=githubToken;});
document.getElementById("save").addEventListener("click",async()=>{
 const token=input.value.trim();
 if(!token){status.textContent="توکن را وارد کن.";return;}
 status.textContent="در حال بررسی دسترسی GitHub…";
 try{
  const response=await fetch("https://api.github.com/repos/Abolvardim/DigiPrice-Tracker/actions/workflows/fetch-history.yml",{headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28"}});
  if(!response.ok)throw new Error(response.status===401?"توکن نامعتبر یا منقضی است.":response.status===403?"مجوز Actions کافی نیست یا دسترسی محدود شده است.":"GitHub پاسخ HTTP "+response.status+" داد.");
  await chrome.storage.local.set({githubToken:token});
  status.textContent="اتصال موفق است و توکن در همین مرورگر ذخیره شد.";
 }catch(error){status.textContent="بررسی ناموفق: "+error.message;}
});