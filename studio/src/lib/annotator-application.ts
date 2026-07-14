import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AnnotatorApplicationForm {
  name: string;
  email: string;
  nativeLanguage: string;
  turkishLevel: string;
  background: string;
  motivation: string;
}

export async function submitAnnotatorApplication(form: AnnotatorApplicationForm) {
  await addDoc(collection(db, "annotatorApplications"), {
    ...form,
    status: "pending",
    createdAt: serverTimestamp(),
    schemaVersion: 1,
  });
}
