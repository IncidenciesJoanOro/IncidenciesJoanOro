var url = "https://script.google.com/macros/s/AKfycbxIIODZkN9VQwntRzRIB_cXWcSDdi4DYRajxss3VBes5JacLEEvChRctJgMlIIfGOTi/exec";   //direcció servidor

//Actualitza el full quan no hi ha activitat
let n=40;  //Temps de espera inactivitat per actualitzar
window.setInterval(function(){
  document.onmousemove=function(){
    n=40
  };
  document.onkeydown=function(){
    n=40
  };
  if(document.querySelectorAll("input")[0] ==undefined){
  n--;
  }

  if(n<=-1){
    login();
    n=40;
  }
},6000);

window.onload = Actualitzar(); 
function Actualitzar(){
  if(sessionStorage.getItem("Dades")!=undefined){
    let data = JSON.parse(sessionStorage.getItem("Dades"));
    CrearDom(data[1],data[2]);
  }
} 

function login(){
  let dades="";
  if(document.querySelectorAll("input")[0] !=undefined){//Login inici
    let InputLogin =document.querySelectorAll("input");
    dades = InputLogin[0].value + "|"+InputLogin[1].value+"|login";

  }else{

    let DadesEnviar = JSON.parse(sessionStorage.getItem("DadesEnviar"));
    
  
    for (let i=0; i<DadesEnviar.length;i++){
      let text1 = new Date().getTime().toString(32) + "|" + DadesEnviar[i].join("|");
      if(i!=DadesEnviar.length -1){
        dades = dades + text1 + "|";
      } else{             //Actualitzar informació
        dades = dades + text1
      }
    }
      //Passe info dels USUARIS.
    let InfoUsuari = JSON.parse(sessionStorage.getItem("Dades"));  
    dades=InfoUsuari[0][0] + "|" + InfoUsuari[0][1] + "|" + InfoUsuari[0][2] + "|" + dades;

  }


  document.getElementById("container").innerHTML="";
  //Enviar les dades al servidor
  Enviar(dades);
}

function Enviar(informacio) {
  
    fetch(url,
    {method: "POST",
    contentType: 'application/json',
    body: JSON.stringify(informacio)
    
    }).then(function (response) {
      // The API call was successful!
      return response.json();
    }).then(function (data) {

      if(typeof(data)=='string'){
        document.getElementById("container").innerHTML="<h1>" + data + "</h1>";
        setTimeout("location.reload()",2000);
      }else{
      // This is the JSON from our response
        sessionStorage.setItem("Dades", JSON.stringify(data));  //Guarda info en local
        sessionStorage.setItem("DadesEnviar", JSON.stringify([]));  //Guarda info en local
  
        CrearDom(data[1],data[2]);
      }

      
    }).catch(function (err) {
      // There was an error
      console.warn('Something went wrong.', err);
    })  
  }


function CrearDom(Capcalera,Info){

  //Crea la taula
  var table = document.createElement('table');
    table.setAttribute('id', 'Tabla');  //afegeix id=incidencia
        //crea capçalera
    let row = document.createElement('tr');  //Crea fila capçalera
    for (let i=0; i<Capcalera.length; i++){
          let cell = document.createElement('th');    //Crea la cela
          cell.innerText = Capcalera[i];    //Inserta el text
          row.appendChild(cell);
        }
        table.appendChild(row);
     
    //Crea contingut
    for (let i = 0; i< Info.length; i++) {
      let row = document.createElement('tr');   //Crea la fila
      for (let j = 2; j < Info[i].length; j++) {
        let cell = document.createElement('td');

        //Crea el desplegable SELECT que es troba en la posició 3.
        if(j==3){
          let desplegable = document.createElement("select");
          desplegable.setAttribute('class', Info[i][1]);
          for (let k=1;k<Info[i][j].length; k++){
            let selecion = Info[i][j].indexOf(Info[i][j][0],1);//busca la posició del valor de la selecció
            let opciones = document.createElement("option");
            //console.log(selecion);
            if(k==selecion){
              opciones.selected="selected";
            }
            opciones.setAttribute('class', Info[i][1]);
            opciones.innerText=Info[i][j][k];
            desplegable.appendChild(opciones);
          }
          cell.appendChild(desplegable);
          row.appendChild(cell);
        }else{    //Afegeix el text
          if(j==Info[i].length-1){   //Fa la descripció editable
            cell.setAttribute('contenteditable', "true");
          };
          cell.setAttribute('class', Info[i][1]); //Afegeix class=Id en fila 2
          cell.innerHTML = Info[i][j];
          row.appendChild(cell);
        }
      }
      table.appendChild(row);
    
    }
    //Crear Botó envio
    let BotonEnvio = document.createElement('button');
    BotonEnvio.setAttribute('id', 'Btn');
    BotonEnvio.setAttribute('class', 'enviar');
    BotonEnvio.innerText = "Enviar Informació";
    //return table;
    var Contenedor = document.getElementById("container");
    Contenedor.innerHTML="";
    Contenedor.appendChild(table);
    Contenedor.appendChild(BotonEnvio);
}


//CREA OBJECTE A ENVIAR
  //Seleccionar la fila que estem modificant
  const cos = document.body;
  cos.addEventListener("mouseup",SaberId);
  cos.addEventListener("keyup",SaberId);




function SaberId(e){

  if(e.target.className == "enviar"){
    //Login aplicació
    var BtnLogin = document.getElementById("Btn");
    BtnLogin.addEventListener("click", login);
  }else{
    if(document.getElementById("Tabla")!=undefined){
      //Canvia la prioritat de la primera columna
      let texto =e.srcElement.innerText;
      switch (texto){
          case "Urgent":
            e.target.innerText="Baixa";
              break;
          case "Baixa":
            e.target.innerText="Normal";
              break;
          case "Normal":
            e.target.innerText="Urgent";
              break;
        }

      //Crea la ARRAY amb la info que es modifica.

      let NomClass = e.target.classList.value;
      let ArrayClass = document.getElementsByClassName(NomClass);

      let LongitudClass = ArrayClass.length;
      
        //Tria si fas click en Select o en Option
      let SelectObject;

        if (e.target.localName.nodeName != "SELECT"){
          SelectObject =ArrayClass[2].parentElement;
        }else{
          SelectObject = e.target;
        }
      let OptionsText = SelectObject.options[SelectObject.selectedIndex].text;
      let ArrayInfo=[NomClass, ArrayClass[0].innerText, OptionsText, ArrayClass[LongitudClass-1].innerText];
    
      //GUARDAR INFO EN ARRAY
      let DadesEnviar = JSON.parse(sessionStorage.getItem("DadesEnviar"));
      let IndexDades = DadesEnviar.map(x=>x[0]).indexOf(NomClass);


      if(IndexDades==-1){
        DadesEnviar = DadesEnviar.concat([ArrayInfo]);
      }else{
        DadesEnviar[IndexDades]=ArrayInfo;
      }
      sessionStorage.setItem("DadesEnviar", JSON.stringify(DadesEnviar));  //Guarda info en local
    }
  }
}
